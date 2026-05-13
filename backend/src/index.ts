import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';

import authRoutes from './routes/auth';
import categoryRoutes from './routes/categories';
import transactionRoutes from './routes/transactions';
import budgetRoutes from './routes/budgets';
import { initializeDatabase } from './utils/database';
import { setupWebSocket } from './services/websocket';

export const app = express();
export const server = createServer(app);
export const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

// Rate limiting (skip during tests to avoid flakes)
if (process.env.NODE_ENV !== 'test') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
  });
  app.use(limiter);
}

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budget', budgetRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Wire WebSocket handlers immediately so tests can connect even without startServer().
setupWebSocket(io);

async function startServer() {
  try {
    await initializeDatabase();

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
