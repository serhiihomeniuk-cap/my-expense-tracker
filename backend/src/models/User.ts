import { query } from '../utils/database';

export interface User {
  id: string;
  provider: string;
  providerUserId: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UserService {
  static async findOrCreate(provider: string, providerUserId: string, profile: any): Promise<User> {
    const { rows } = await query(
      `SELECT * FROM users WHERE provider = $1 AND provider_user_id = $2`,
      [provider, providerUserId]
    );

    if (rows.length > 0) {
      return rows[0];
    }

    // Create new user
    const { rows: newUser } = await query(
      `INSERT INTO users (provider, provider_user_id, email, display_name, avatar_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        provider,
        providerUserId,
        profile.email,
        profile.displayName || profile.name,
        profile.avatarUrl || profile.photos?.[0]?.value
      ]
    );

    // Create default "Uncategorized" category for new user
    await query(
      `INSERT INTO categories (user_id, name) VALUES ($1, $2)`,
      [newUser[0].id, 'Uncategorized']
    );

    return newUser[0];
  }

  static async findById(id: string): Promise<User | null> {
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [id]);
    return rows.length > 0 ? rows[0] : null;
  }
}