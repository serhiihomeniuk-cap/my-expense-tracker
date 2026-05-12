import { query } from '../utils/database';

export interface BudgetAlert {
  id: string;
  userId: string;
  year: number;
  month: number;
  threshold: number;
  sentAt: Date;
}

export interface BudgetAlertNotification {
  threshold: number;
  year: number;
  month: number;
  spent: number;
  budget: number;
  percentage: number;
}

/**
 * Records any newly-crossed thresholds for the given user/month into `budget_alerts`
 * and returns the list of newly-recorded alerts (one entry per newly-crossed threshold).
 *
 * Returns [] when no budget is set, when the user is not over any threshold, or when
 * all crossed thresholds have already been recorded for the month. The (user_id, year,
 * month, threshold) UNIQUE constraint guarantees once-per-threshold-per-month delivery
 * even under concurrent inserts.
 */
export const checkBudgetAlerts = async (
  userId: string,
  year: number,
  month: number
): Promise<BudgetAlertNotification[]> => {
  const { rows: budgetRows } = await query(
    'SELECT amount FROM budgets WHERE user_id = $1 AND year = $2 AND month = $3',
    [userId, year, month]
  );

  if (budgetRows.length === 0) {
    // No budget set => no alerts at all (spec).
    return [];
  }

  const budget = parseFloat(budgetRows[0].amount);
  if (!(budget > 0)) {
    return [];
  }

  const { rows: spentRows } = await query(
    `SELECT COALESCE(SUM(amount), 0) AS total_spent
       FROM transactions
      WHERE user_id = $1
        AND EXTRACT(YEAR FROM transaction_date) = $2
        AND EXTRACT(MONTH FROM transaction_date) = $3`,
    [userId, year, month]
  );

  const totalSpent = parseFloat(spentRows[0].total_spent);
  const percentage = (totalSpent / budget) * 100;

  const thresholds = [50, 80, 100];
  const newAlerts: BudgetAlertNotification[] = [];

  for (const threshold of thresholds) {
    if (percentage >= threshold) {
      // ON CONFLICT DO NOTHING ensures we never record the same threshold twice.
      const { rows } = await query(
        `INSERT INTO budget_alerts (user_id, year, month, threshold)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, year, month, threshold) DO NOTHING
         RETURNING id`,
        [userId, year, month, threshold]
      );

      if (rows.length > 0) {
        newAlerts.push({
          threshold,
          year,
          month,
          spent: totalSpent,
          budget,
          percentage
        });
      }
    }
  }

  return newAlerts;
};

export const getBudgetAlerts = async (userId: string, year: number, month: number) => {
  const { rows } = await query(
    'SELECT * FROM budget_alerts WHERE user_id = $1 AND year = $2 AND month = $3 ORDER BY threshold',
    [userId, year, month]
  );
  return rows;
};
