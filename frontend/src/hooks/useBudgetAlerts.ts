import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

export interface BudgetAlertMessage {
  type: 'budget_alert';
  threshold: number;
  spent: number;
  budget: number;
  percentage: number;
  month: string;
  message: string;
}

export interface ReceivedAlert extends BudgetAlertMessage {
  // Local id so the UI can dismiss without affecting server-side dedup.
  localId: string;
}

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export const useBudgetAlerts = () => {
  const { token } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [alerts, setAlerts] = useState<ReceivedAlert[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      // Spec requires the client to send at least one meaningful message.
      socket.emit('subscribe');
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('budget_alert', (msg: BudgetAlertMessage) => {
      setAlerts(prev => {
        // Dedupe in-UI by (month, threshold) so a refresh that re-emits
        // the same recorded alerts doesn't stack duplicates.
        if (prev.some(a => a.month === msg.month && a.threshold === msg.threshold)) {
          return prev;
        }
        const localId = `${msg.month}-${msg.threshold}-${Date.now()}`;
        return [...prev, { ...msg, localId }];
      });
    });

    socket.on('connect_error', (err) => {
      console.error('Budget alert socket connect_error:', err.message);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  const dismiss = useCallback((localId: string) => {
    setAlerts(prev => prev.filter(a => a.localId !== localId));
    socketRef.current?.emit('ack', { alertId: localId });
  }, []);

  return { alerts, dismiss, connected };
};
