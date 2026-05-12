import express from 'express';
import { query } from '../utils/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { checkBudgetAlerts } from '../services/budgetAlerts';
import { sendBudgetAlert } from '../services/websocket';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get budget for specific month
router.get('/:year/:month', async (req: AuthRequest, res) => {
  const { year, month } = req.params;

  try {
    // Get budget
    const { rows: budgetRows } = await query(
      'SELECT * FROM budgets WHERE user_id = $1 AND year = $2 AND month = $3',
      [req.user!.id, parseInt(year), parseInt(month)]
    );

    // Get total spent for the month
    const { rows: spentRows } = await query(
      `SELECT COALESCE(SUM(amount), 0) as total_spent
       FROM transactions
       WHERE user_id = $1 AND EXTRACT(YEAR FROM transaction_date) = $2 AND EXTRACT(MONTH FROM transaction_date) = $3`,
      [req.user!.id, parseInt(year), parseInt(month)]
    );

    const budget = budgetRows[0];
    const totalSpent = parseFloat(spentRows[0].total_spent);

    const response: any = {
      year: parseInt(year),
      month: parseInt(month),
      totalSpent,
      currency: 'USD'
    };

    if (budget) {
      response.budget = parseFloat(budget.amount);
      response.remaining = response.budget - totalSpent;
      response.percentage = response.budget > 0 ? (totalSpent / response.budget) * 100 : 0;
    }

    res.json(response);
  } catch (error) {
    console.error('Error fetching budget:', error);
    res.status(500).json({ error: 'Failed to fetch budget' });
  }
});

// Set budget for specific month
router.post('/:year/:month', async (req: AuthRequest, res) => {
  const { year, month } = req.params;
  const { amount } = req.body;

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Budget amount must be a positive number' });
  }

  try {
    const { rows } = await query(
      `INSERT INTO budgets (user_id, year, month, amount)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, year, month)
       DO UPDATE SET amount = EXCLUDED.amount, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.user!.id, parseInt(year), parseInt(month), amount]
    );

    res.json(rows[0]);

    // Recompute thresholds after the budget change and push any new alerts.
    try {
      const newAlerts = await checkBudgetAlerts(req.user!.id, parseInt(year), parseInt(month));
      for (const alert of newAlerts) {
        sendBudgetAlert(req.user!.id, alert);
      }
    } catch (alertError) {
      console.error('Error pushing budget alerts after budget change:', alertError);
    }
  } catch (error) {
    console.error('Error setting budget:', error);
    res.status(500).json({ error: 'Failed to set budget' });
  }
});

// Remove budget for specific month
router.delete('/:year/:month', async (req: AuthRequest, res) => {
  const { year, month } = req.params;

  try {
    const { rowCount } = await query(
      'DELETE FROM budgets WHERE user_id = $1 AND year = $2 AND month = $3',
      [req.user!.id, parseInt(year), parseInt(month)]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    res.json({ message: 'Budget removed successfully' });
  } catch (error) {
    console.error('Error removing budget:', error);
    res.status(500).json({ error: 'Failed to remove budget' });
  }
});

export default router;