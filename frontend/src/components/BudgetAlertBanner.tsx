import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useBudgetAlerts } from '../hooks/useBudgetAlerts';

const styleForThreshold = (threshold: number) => {
  if (threshold >= 100) {
    return { bar: 'bg-red-50 border-red-300 text-red-800', icon: 'text-red-500' };
  }
  if (threshold >= 80) {
    return { bar: 'bg-orange-50 border-orange-300 text-orange-800', icon: 'text-orange-500' };
  }
  return { bar: 'bg-yellow-50 border-yellow-300 text-yellow-800', icon: 'text-yellow-500' };
};

const BudgetAlertBanner: React.FC = () => {
  const { alerts, dismiss } = useBudgetAlerts();

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col space-y-2 w-96 max-w-[calc(100vw-2rem)]"
      role="status"
      aria-live="polite"
    >
      {alerts.map((alert) => {
        const styles = styleForThreshold(alert.threshold);
        return (
          <div
            key={alert.localId}
            className={`border rounded-md shadow-md px-4 py-3 flex items-start ${styles.bar}`}
          >
            <AlertTriangle className={`w-5 h-5 mt-0.5 mr-3 flex-shrink-0 ${styles.icon}`} />
            <div className="flex-1 text-sm">
              <p className="font-semibold">Budget alert: {alert.threshold}% reached</p>
              <p className="mt-1">
                ${alert.spent.toFixed(2)} of ${alert.budget.toFixed(2)} spent
                ({alert.percentage.toFixed(1)}%) for {alert.month}.
              </p>
            </div>
            <button
              onClick={() => dismiss(alert.localId)}
              aria-label="Dismiss alert"
              className="ml-3 text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default BudgetAlertBanner;
