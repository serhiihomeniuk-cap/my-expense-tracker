import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface BudgetData {
  year: number;
  month: number;
  budget?: number;
  totalSpent: number;
  remaining?: number;
  percentage?: number;
  currency: string;
}

const Dashboard: React.FC = () => {
  const { token } = useAuth();
  const [budgetData, setBudgetData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  useEffect(() => {
    fetchBudgetData();
  }, [selectedMonth, token]);

  const fetchBudgetData = async () => {
    if (!token) return;

    try {
      const year = selectedMonth.getFullYear();
      const month = selectedMonth.getMonth() + 1;

      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/budget/${year}/${month}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setBudgetData(response.data);
    } catch (error) {
      console.error('Failed to fetch budget data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMonthChange = (direction: 'prev' | 'next') => {
    setSelectedMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => handleMonthChange('prev')}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Previous Month
        </button>

        <h1 className="text-2xl font-bold text-gray-900">
          {format(selectedMonth, 'MMMM yyyy')}
        </h1>

        <button
          onClick={() => handleMonthChange('next')}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Next Month
        </button>
      </div>

      {/* Budget Overview */}
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Budget Overview</h3>

          {budgetData?.budget ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500">Monthly Budget</span>
                <span className="text-sm font-semibold text-gray-900">
                  ${budgetData.budget.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500">Total Spent</span>
                <span className="text-sm font-semibold text-gray-900">
                  ${budgetData.totalSpent.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500">Remaining</span>
                <span className={`text-sm font-semibold ${
                  (budgetData.remaining || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  ${(budgetData.remaining || 0).toFixed(2)}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Budget Usage</span>
                  <span>{(budgetData.percentage || 0).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      (budgetData.percentage || 0) >= 100 ? 'bg-red-500' :
                      (budgetData.percentage || 0) >= 80 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(budgetData.percentage || 0, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No budget set for this month</p>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                Set Budget
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Transactions</h3>
          <p className="text-gray-500">Transaction list will be implemented here</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;