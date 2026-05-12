import dotenv from 'dotenv';

// Load .env so DATABASE_URL is populated if present, then force test-mode.
dotenv.config();

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-do-not-use-in-prod';

// Provide harmless OAuth env defaults so Passport strategies don't throw at import time.
// Tests do NOT hit the real OAuth flow.
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-google-id';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'test-google-secret';
process.env.GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback';
process.env.GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'test-github-id';
process.env.GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'test-github-secret';
process.env.GITHUB_REDIRECT_URI =
  process.env.GITHUB_REDIRECT_URI || 'http://localhost:3001/auth/github/callback';

process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://expense_user:expense_password@localhost:5432/expense_tracker';
