import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { checkBudgetAlerts, BudgetAlertNotification } from './budgetAlerts';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

let ioRef: Server | null = null;

export const setupWebSocket = (io: Server) => {
  ioRef = io;

  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    try {
      const decoded = jwt.verify(token as string, process.env.JWT_SECRET!) as any;
      socket.userId = decoded.user.id;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`User ${socket.userId} connected`);

    socket.join(`user_${socket.userId}`);

    // Spec requires alerts recompute on WS connection open as well.
    deliverCurrentMonthAlerts(socket.userId!).catch(err => {
      console.error('Error delivering alerts on connect:', err);
    });

    socket.on('subscribe', async () => {
      console.log(`User ${socket.userId} subscribed to alerts`);
      try {
        await deliverCurrentMonthAlerts(socket.userId!);
      } catch (error) {
        console.error('Error checking budget alerts on subscribe:', error);
      }
    });

    socket.on('ack', (data: any) => {
      console.log(`User ${socket.userId} acknowledged alert:`, data);
    });

    socket.on('disconnect', () => {
      console.log(`User ${socket.userId} disconnected`);
    });
  });
};

const deliverCurrentMonthAlerts = async (userId: string) => {
  const now = new Date();
  const alerts = await checkBudgetAlerts(userId, now.getFullYear(), now.getMonth() + 1);
  for (const alert of alerts) {
    sendBudgetAlert(userId, alert);
  }
};

export const sendBudgetAlert = (userId: string, alert: BudgetAlertNotification) => {
  if (!ioRef) {
    console.warn('sendBudgetAlert called before setupWebSocket(); dropping alert');
    return;
  }
  ioRef.to(`user_${userId}`).emit('budget_alert', {
    type: 'budget_alert',
    threshold: alert.threshold,
    spent: alert.spent,
    budget: alert.budget,
    percentage: alert.percentage,
    month: `${alert.year}-${alert.month.toString().padStart(2, '0')}`,
    message: `You've reached ${alert.threshold}% of your monthly budget`
  });
};
