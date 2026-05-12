import express from 'express';
import { query } from '../utils/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { checkBudgetAlerts } from '../services/budgetAlerts';
import { sendBudgetAlert } from '../services/websocket';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

const recomputeAndPushAlerts = async (userId: string, dates: Array<string | Date>) => {
  const seen = new Set<string>();
  for (const d of dates) {
    if (!d) continue;
    const date = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(date.getTime())) continue;
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const key = `${year}-${month}`;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const alerts = await checkBudgetAlerts(userId, year, month);
      for (const alert of alerts) {
        sendBudgetAlert(userId, alert);
      }
    } catch (err) {
      console.error(`Failed to recompute alerts for ${userId} ${key}:`, err);
    }
  }
};

// Get transactions with optional filters
router.get('/', async (req: AuthRequest, res) => {
  const {
    category_id,
    start_date,
    end_date,
    search,
    page = '1',
    limit = '50'
  } = req.query;

  try {
    let queryText = `
      SELECT t.*, c.name as category_name
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = $1
    `;
    const queryParams: any[] = [req.user!.id];
    let paramIndex = 2;

    if (category_id) {
      queryText += ` AND t.category_id = $${paramIndex}`;
      queryParams.push(category_id);
      paramIndex++;
    }

    if (start_date) {
      queryText += ` AND t.transaction_date >= $${paramIndex}`;
      queryParams.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      queryText += ` AND t.transaction_date <= $${paramIndex}`;
      queryParams.push(end_date);
      paramIndex++;
    }

    if (search) {
      queryText += ` AND (t.title ILIKE $${paramIndex} OR t.notes ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    queryText += ' ORDER BY t.transaction_date DESC, t.created_at DESC';
    queryText += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(parseInt(limit as string), (parseInt(page as string) - 1) * parseInt(limit as string));

    const { rows } = await query(queryText, queryParams);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Create transaction
router.post('/', async (req: AuthRequest, res) => {
  const { title, amount, category_id, transaction_date, notes, currency = 'USD' } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ error: 'Title is required' });
  }

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }

  if (!category_id) {
    return res.status(400).json({ error: 'Category is required' });
  }

  if (!transaction_date || Number.isNaN(new Date(transaction_date).getTime())) {
    return res.status(400).json({ error: 'Transaction date is required' });
  }

  try {
    const { rows: categoryRows } = await query(
      'SELECT id FROM categories WHERE id = $1 AND user_id = $2',
      [category_id, req.user!.id]
    );

    if (categoryRows.length === 0) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const { rows } = await query(
      `INSERT INTO transactions (user_id, category_id, title, amount, currency, transaction_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.user!.id, category_id, title.trim(), amount, currency, transaction_date, notes?.trim()]
    );

    res.status(201).json(rows[0]);
    await recomputeAndPushAlerts(req.user!.id, [rows[0].transaction_date]);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// Update transaction
router.put('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { title, amount, category_id, transaction_date, notes, currency } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ error: 'Title is required' });
  }

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }

  if (!category_id) {
    return res.status(400).json({ error: 'Category is required' });
  }

  if (!transaction_date || Number.isNaN(new Date(transaction_date).getTime())) {
    return res.status(400).json({ error: 'Transaction date is required' });
  }

  try {
    // Verify transaction belongs to user; capture old date so we recompute the old month too if it changed.
    const { rows: existingRows } = await query(
      'SELECT id, transaction_date FROM transactions WHERE id = $1 AND user_id = $2',
      [id, req.user!.id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    const oldDate: Date = existingRows[0].transaction_date;

    const { rows: categoryRows } = await query(
      'SELECT id FROM categories WHERE id = $1 AND user_id = $2',
      [category_id, req.user!.id]
    );

    if (categoryRows.length === 0) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const { rows } = await query(
      `UPDATE transactions
         SET title = $1, amount = $2, category_id = $3, transaction_date = $4,
             notes = $5, currency = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND user_id = $8
       RETURNING *`,
      [title.trim(), amount, category_id, transaction_date, notes?.trim(), currency || 'USD', id, req.user!.id]
    );

    res.json(rows[0]);
    await recomputeAndPushAlerts(req.user!.id, [oldDate, rows[0].transaction_date]);
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// Delete transaction
router.delete('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    const { rows } = await query(
      'DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING transaction_date',
      [id, req.user!.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ message: 'Transaction deleted successfully' });
    await recomputeAndPushAlerts(req.user!.id, [rows[0].transaction_date]);
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

export default router;
