import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search } from 'lucide-react';

interface Transaction {
  id: string;
  title: string;
  amount: number;
  currency: string;
  transaction_date: string;
  category_name: string;
  category_id: string;
  notes?: string;
}

interface Category {
  id: string;
  name: string;
}

interface TransactionFormState {
  title: string;
  amount: string;
  category_id: string;
  transaction_date: string;
  notes: string;
}

interface TransactionFormErrors {
  title?: string;
  amount?: string;
  category_id?: string;
  transaction_date?: string;
  submit?: string;
}

const today = () => new Date().toISOString().slice(0, 10);

const blankForm = (): TransactionFormState => ({
  title: '',
  amount: '',
  category_id: '',
  transaction_date: today(),
  notes: ''
});

const Transactions: React.FC = () => {
  const { token } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TransactionFormState>(blankForm());
  const [errors, setErrors] = useState<TransactionFormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTransactions();
    fetchCategories();
  }, [token]);

  const fetchTransactions = async () => {
    if (!token) return;

    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/transactions`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            search: searchTerm,
            category_id: selectedCategory || undefined
          }
        }
      );
      setTransactions(response.data);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    if (!token) return;

    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/categories`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCategories(response.data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, selectedCategory]);

  const openAddForm = () => {
    setForm(blankForm());
    setErrors({});
    setShowForm(true);
  };

  const validate = (state: TransactionFormState): TransactionFormErrors => {
    const next: TransactionFormErrors = {};
    if (!state.title.trim()) {
      next.title = 'Title is required';
    }
    const amountNum = Number(state.amount);
    if (!state.amount || Number.isNaN(amountNum) || amountNum <= 0) {
      next.amount = 'Amount must be greater than 0';
    }
    if (!state.category_id) {
      next.category_id = 'Category is required';
    }
    if (!state.transaction_date || Number.isNaN(new Date(state.transaction_date).getTime())) {
      next.transaction_date = 'Valid date is required';
    }
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const validation = validate(form);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }

    setSubmitting(true);
    setErrors({});
    try {
      await axios.post(
        `${process.env.REACT_APP_API_URL}/api/transactions`,
        {
          title: form.title.trim(),
          amount: Number(form.amount),
          category_id: form.category_id,
          transaction_date: form.transaction_date,
          notes: form.notes.trim() || undefined,
          currency: 'USD'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowForm(false);
      setForm(blankForm());
      await fetchTransactions();
    } catch (error: any) {
      console.error('Failed to create transaction:', error);
      setErrors({ submit: error?.response?.data?.error || 'Failed to create transaction' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <button
          onClick={openAddForm}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Transaction
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="w-48">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {transactions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No transactions found</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {transactions.map((transaction) => (
              <li key={transaction.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">
                        {transaction.title}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(transaction.transaction_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-sm text-gray-600">
                        {transaction.category_name}
                      </p>
                      <p className="text-sm font-semibold text-gray-900">
                        {transaction.currency} {Number(transaction.amount).toFixed(2)}
                      </p>
                    </div>
                    {transaction.notes && (
                      <p className="text-sm text-gray-500 mt-1">
                        {transaction.notes}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-40">
          <div className="relative top-20 mx-auto p-5 border w-[28rem] max-w-[calc(100vw-2rem)] shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Add Transaction</h3>
            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-3">
                <label htmlFor="tx-title" className="block text-sm font-medium text-gray-700">Title</label>
                <input
                  id="tx-title"
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
              </div>

              <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="tx-amount" className="block text-sm font-medium text-gray-700">
                    Amount (USD)
                  </label>
                  <input
                    id="tx-amount"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount}</p>}
                </div>
                <div>
                  <label htmlFor="tx-date" className="block text-sm font-medium text-gray-700">Date</label>
                  <input
                    id="tx-date"
                    type="date"
                    value={form.transaction_date}
                    onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.transaction_date && (
                    <p className="mt-1 text-xs text-red-600">{errors.transaction_date}</p>
                  )}
                </div>
              </div>

              <div className="mb-3">
                <label htmlFor="tx-category" className="block text-sm font-medium text-gray-700">Category</label>
                <select
                  id="tx-category"
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Select a category</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {errors.category_id && <p className="mt-1 text-xs text-red-600">{errors.category_id}</p>}
              </div>

              <div className="mb-3">
                <label htmlFor="tx-notes" className="block text-sm font-medium text-gray-700">
                  Notes (optional)
                </label>
                <textarea
                  id="tx-notes"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {errors.submit && (
                <p className="mb-3 text-sm text-red-600">{errors.submit}</p>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
