import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { getRecurring, addRecurring, markPaid, markUnpaid, deleteRecurring } from '../services/recurringService';
import { getCategories } from '../services/categoryService';
import { formatCurrency } from '../utils/format';

// ─── Stat Box ────────────────────────────────────────────────────────────────
function StatBox({ label, value, sub, accent, delay = '0ms' }) {
  return (
    <div
      className={`
        rounded-2xl p-5 shadow-sm border animate-fadeIn
        transition-all duration-300 hover:shadow-md hover:-translate-y-0.5
        ${accent
          ? 'bg-gradient-to-br from-ocean to-blueberry border-ocean/20 text-white'
          : 'bg-white border-skylight/30 text-ocean'
        }
      `}
      style={{ animationDelay: delay }}
    >
      <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${accent ? 'text-skylight/80' : 'text-ocean/50'}`}>
        {label}
      </p>
      <p className={`text-2xl font-bold tracking-tight ${accent ? 'text-white' : 'text-ocean'}`}>
        {value}
      </p>
      {sub && (
        <p className={`text-[11px] mt-1.5 ${accent ? 'text-skylight/70' : 'text-bluebird/70'}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ─── Add Form ────────────────────────────────────────────────────────────────
function RecurringForm({ onSubmit, onCancel, saving, categories = [] }) {
  const [form, setForm] = useState({ name: '', amount: '', category: '', dueDay: '' });

  const inputClass = `
    w-full px-3.5 py-2.5 rounded-xl border border-skylight/40 bg-skylight/10
    text-ocean text-sm placeholder:text-bluebird/40
    focus:outline-none focus:ring-2 focus:ring-blueberry/30 focus:border-blueberry/40
    transition duration-150
  `;
  const labelClass = "block text-[11px] font-semibold text-ocean/50 uppercase tracking-wider mb-1.5";

  const suggestedCategories = categories.length > 0 ? categories : [
    'Electricity', 'Internet', 'Rent', 'Water', 'Gas',
    'Insurance', 'EMI', 'Maintenance', 'Subscription', 'Other'
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Expense Name</label>
          <input
            type="text" required
            value={form.name}
            onChange={e => setForm({...form, name: e.target.value})}
            placeholder="Electricity Bill"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Amount (₹)</label>
          <input
            type="number" required
            value={form.amount}
            onChange={e => setForm({...form, amount: e.target.value})}
            placeholder="3000"
            className={inputClass}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Category</label>
          <select
            value={form.category}
            onChange={e => setForm({...form, category: e.target.value})}
            className={inputClass}
          >
            <option value="">— Select —</option>
            {suggestedCategories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Due Day of Month</label>
          <input
            type="number" required
            min="1" max="31"
            value={form.dueDay}
            onChange={e => setForm({...form, dueDay: e.target.value})}
            placeholder="15"
            className={inputClass}
          />
        </div>
      </div>
      <div className="border-t border-skylight/30 pt-4 flex gap-3">
        <button
          type="button" onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-skylight/40 text-sm font-medium text-ocean/70 hover:bg-skylight/10 transition duration-150"
        >
          Cancel
        </button>
        <button
          type="submit" disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-ocean to-blueberry text-white text-sm font-semibold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Saving…
            </>
          ) : 'Add Expense'}
        </button>
      </div>
    </form>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function RecurringExpenses() {
  const [expenses, setExpenses]         = useState([]);
  const [categories, setCategories]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [saving, setSaving]             = useState(false);

  const fetchData = async () => {
    try {
      const [data, cats] = await Promise.all([getRecurring(), getCategories()]);
      setExpenses(data);
      setCategories(cats.map(c => c.name));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAdd = async (form) => {
    setSaving(true);
    try {
      await addRecurring(form);
      setShowModal(false);
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaid = async (id) => {
    await markPaid(id);
    fetchData();
  };

  const handleMarkUnpaid = async (id) => {
    await markUnpaid(id);
    fetchData();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this recurring expense?')) return;
    await deleteRecurring(id);
    fetchData();
  };

  const paid   = expenses.filter(e => e.isPaidThisMonth);
  const unpaid = expenses.filter(e => !e.isPaidThisMonth);
  const totalMonthly  = expenses.reduce((s, e) => s + e.amount, 0);
  const totalPaid     = paid.reduce((s, e) => s + e.amount, 0);
  const totalUnpaid   = unpaid.reduce((s, e) => s + e.amount, 0);

  const currentMonthLabel = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  // Sort unpaid by dueDay ascending (most urgent first)
  const sortedUnpaid = [...unpaid].sort((a, b) => a.dueDay - b.dueDay);
  const sortedPaid   = [...paid].sort((a, b) => a.dueDay - b.dueDay);

  return (
    <Layout>

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-7 animate-fadeIn">
        <div>
          <h2 className="text-xl font-semibold text-ocean">Recurring Expenses</h2>
          <p className="text-sm text-bluebird mt-0.5">{currentMonthLabel}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-ocean to-blueberry text-white text-sm font-medium rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Expense
        </button>
      </div>

      {/* ── Stat boxes ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatBox
          label="Total Monthly"
          value={formatCurrency(totalMonthly)}
          sub={`${expenses.length} expenses`}
          accent
          delay="0ms"
        />
        <StatBox
          label="Paid This Month"
          value={formatCurrency(totalPaid)}
          sub={`${paid.length} done`}
          delay="60ms"
        />
        <StatBox
          label="Still Unpaid"
          value={formatCurrency(totalUnpaid)}
          sub={`${unpaid.length} pending`}
          delay="120ms"
        />
      </div>

      {/* ── Unpaid section ── */}
      {sortedUnpaid.length > 0 && (
        <div className="bg-white rounded-2xl border border-skylight/30 shadow-sm overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-skylight/20 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <h3 className="text-sm font-semibold text-ocean">Unpaid This Month</h3>
            <span className="ml-auto text-xs font-semibold text-red-400 bg-red-50 px-2.5 py-1 rounded-full border border-red-100">
              {sortedUnpaid.length} pending
            </span>
          </div>
          <div className="divide-y divide-skylight/20">
            {sortedUnpaid.map((expense, index) => {
              const today = new Date().getDate();
              const isOverdue = today > expense.dueDay;
              const isDueSoon = !isOverdue && expense.dueDay - today <= 3;

              return (
                <div
                  key={expense._id}
                  className="px-5 py-4 flex items-center justify-between gap-4 animate-fadeIn"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-ocean truncate">{expense.name}</p>
                      {isOverdue && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-100 shrink-0">
                          Overdue
                        </span>
                      )}
                      {isDueSoon && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100 shrink-0">
                          Due Soon
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {expense.category && (
                        <span className="text-[11px] text-bluebird/60">{expense.category}</span>
                      )}
                      <span className="text-bluebird/30 text-[11px]">·</span>
                      <span className="text-[11px] text-bluebird/60">Due day {expense.dueDay}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-sm font-bold text-ocean">{formatCurrency(expense.amount)}</p>
                    <button
                      onClick={() => handleMarkPaid(expense._id)}
                      className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-600 text-xs font-semibold rounded-lg border border-green-200 transition-all duration-200"
                    >
                      ✓ Mark Paid
                    </button>
                    <button
                      onClick={() => handleDelete(expense._id)}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-400 text-xs font-semibold rounded-lg border border-red-200 transition-all duration-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Paid section ── */}
      {sortedPaid.length > 0 && (
        <div className="bg-white rounded-2xl border border-skylight/30 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-skylight/20 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <h3 className="text-sm font-semibold text-ocean">Paid This Month</h3>
            <span className="ml-auto text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-100">
              {sortedPaid.length} done
            </span>
          </div>
          <div className="divide-y divide-skylight/20">
            {sortedPaid.map((expense, index) => (
              <div
                key={expense._id}
                className="px-5 py-4 flex items-center justify-between gap-4 animate-fadeIn"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ocean/50 line-through truncate">{expense.name}</p>
                  <div className="flex items-center gap-2">
                    {expense.category && (
                      <span className="text-[11px] text-bluebird/40">{expense.category}</span>
                    )}
                    <span className="text-bluebird/20 text-[11px]">·</span>
                    <span className="text-[11px] text-bluebird/40">Due day {expense.dueDay}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className="text-sm font-bold text-ocean/50">{formatCurrency(expense.amount)}</p>
                  <button
                    onClick={() => handleMarkUnpaid(expense._id)}
                    className="px-3 py-1.5 bg-skylight/20 hover:bg-skylight/30 text-bluebird text-xs font-semibold rounded-lg border border-skylight/40 transition-all duration-200"
                  >
                    Undo
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {expenses.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-24 animate-fadeIn">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-ocean to-blueberry flex items-center justify-center mb-4 shadow-md">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-ocean mb-1">No recurring expenses yet</p>
          <p className="text-xs text-bluebird/70 mb-4">Add bills like electricity, rent, internet</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-5 py-2 bg-gradient-to-r from-ocean to-blueberry text-white text-sm font-medium rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
          >
            Add your first bill →
          </button>
        </div>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <Modal title="Add Recurring Expense" onClose={() => setShowModal(false)}>
          <RecurringForm
            onSubmit={handleAdd}
            onCancel={() => setShowModal(false)}
            saving={saving}
            categories={categories}
          />
        </Modal>
      )}

    </Layout>
  );
}