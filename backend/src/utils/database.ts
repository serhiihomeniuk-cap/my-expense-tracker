import { Pool } from 'pg';
import sqlite3 from 'sqlite3';
import path from 'path';

let db: any;
let isUsingSQLite = false;

// Determine which database to use based on DATABASE_URL
const dbUrl = process.env.DATABASE_URL || 'sqlite:./expense-tracker.db';

if (dbUrl.startsWith('sqlite:')) {
  // SQLite mode
  isUsingSQLite = true;
  const dbPath = dbUrl.replace('sqlite:', '');
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('SQLite connection error:', err);
    }
  });
} else {
  // PostgreSQL mode
  isUsingSQLite = false;
}

const pool = !isUsingSQLite ? new Pool({
  connectionString: dbUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
}) : null;

export const query = (text: string, params?: any[]) => {
  if (isUsingSQLite && db) {
    return new Promise((resolve, reject) => {
      if (text.toUpperCase().startsWith('SELECT')) {
        db.all(text, params || [], (err: any, rows: any) => {
          if (err) reject(err);
          else resolve({ rows });
        });
      } else {
        db.run(text, params || [], (err: any) => {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        });
      }
    });
  } else if (pool) {
    return pool.query(text, params);
  } else {
    throw new Error('No database connection available');
  }
};

export const getClient = () => {
  if (pool) {
    return pool.connect();
  }
  throw new Error('getClient is only available for PostgreSQL');
};

export const initializeDatabase = async () => {
  try {
    if (isUsingSQLite) {
      // Enable foreign keys for SQLite
      await query('PRAGMA foreign_keys = ON');
      console.log('✅ SQLite database initialized (file: ' + (process.env.DATABASE_URL || 'expense-tracker.db') + ')');
    } else {
      // Test PostgreSQL connection
      await query('SELECT NOW()');
      console.log('✅ PostgreSQL database connected successfully');
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};

export default { query, getClient, initializeDatabase, isUsingSQLite };
