import jwt from 'jsonwebtoken';
import { query } from '../utils/database';

export interface SeededUser {
  id: string;
  provider: string;
  provider_user_id: string;
  email: string | null;
  display_name: string | null;
  token: string;
}

export const truncateAll = async () => {
  await query(
    'TRUNCATE budget_alerts, transactions, budgets, categories, users RESTART IDENTITY CASCADE'
  );
};

/**
 * Inserts a user row directly. This is the post-OAuth state — what UserService.findOrCreate
 * produces after a successful Google/GitHub login. Tests use this to bypass real network calls
 * to the providers while still exercising the rest of the stack.
 */
export const seedUser = async (overrides: Partial<{
  provider: string;
  providerUserId: string;
  email: string;
  displayName: string;
}> = {}): Promise<SeededUser> => {
  const provider = overrides.provider ?? 'google';
  const providerUserId = overrides.providerUserId ?? `mock-${provider}-${Date.now()}-${Math.random()}`;
  const email = overrides.email ?? `${providerUserId}@example.com`;
  const displayName = overrides.displayName ?? 'Test User';

  const { rows } = await query(
    `INSERT INTO users (provider, provider_user_id, email, display_name)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [provider, providerUserId, email, displayName]
  );

  const user = rows[0];
  const token = jwt.sign(
    {
      user: {
        id: user.id,
        provider: user.provider,
        providerUserId: user.provider_user_id,
        email: user.email,
        displayName: user.display_name
      }
    },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' }
  );

  return { ...user, token };
};

export const createCategoryFor = async (userId: string, name: string) => {
  const { rows } = await query(
    'INSERT INTO categories (user_id, name) VALUES ($1, $2) RETURNING *',
    [userId, name]
  );
  return rows[0];
};

export const setBudgetFor = async (userId: string, year: number, month: number, amount: number) => {
  const { rows } = await query(
    `INSERT INTO budgets (user_id, year, month, amount)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, year, month) DO UPDATE SET amount = EXCLUDED.amount
     RETURNING *`,
    [userId, year, month, amount]
  );
  return rows[0];
};

export const currentYearMonth = () => {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
};
