import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { getEMIs, addEMI, markInstallmentPaid, updateInstallmentAmount, deleteEMI } from '../services/emiService';
import { getCards } from '../services/cardService';
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

// ─── Add EMI Form ─────────────────────────────────────────────────────────────
function EMIForm({ onSubmit, onCancel, saving, cards }) {
  const [form, setForm] = useState({
    title: '',
    loanType: 'loan',
    cardId: '',
    principalAmount: '',
    monthlyAmount: '',
    tenureMonths: '',
    interestRate: '',
    startDate: '',
    lenderName: ''
  });

  const inputClass = `
    w-full px-3.5 py-2.5 rounded-xl border border-skylight/40 bg-skylight/10
    text-ocean text-sm placeholder:text-bluebird/40
    focus:outline-none focus:ring-2 focus:ring-blueberry/30 focus:border-blueberry/40
    transition duration-150
  `;
  const labelClass = "block text-[11px] font-semibold text-ocean/50 uppercase tracking-wider mb-1.5";

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      <div>
        <label className={labelClass}>Title</label>
        <input
          type="text" required
          value={form.title}
          onChange={e => setForm({ ...form, title: e.target.value })}
          placeholder="Bike Loan, iPhone 15 EMI..."
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>EMI Type</label>
        <select
          value={form.loanType}
          onChange={e => setForm({ ...form, loanType: e.target.value, cardId: '' })}
          className={inputClass}
        >
          <option value="loan">Loan (Personal / Car / Other)</option>
          <option value="credit_card">Credit Card EMI Conversion</option>
        </select>
      </div>

      {form.loanType === 'credit_card' && (
        <div>
          <label className={labelClass}>Card</label>
          <select
            required
            value={form.cardId}
            onChange={e => setForm({ ...form, cardId: e.target.value })}
            className={inputClass}
          >
            <option value="">Select card</option>
            {cards.map(c => (
              <option key={c._id} value={c._id}>{c.cardName} — {c.bankName}</option>
            ))}
          </select>
        </div>
      )}

      {form.loanType === 'loan' && (
        <div>
          <label className={labelClass}>Lender Name</label>
          <input
            type="text"
            value={form.lenderName}
            onChange={e => setForm({ ...form, lenderName: e.target.value })}
            placeholder="HDFC Bank, Bajaj Finserv..."
            className={inputClass}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Principal Amount (₹)</label>
          <input
            type="number" required
            value={form.principalAmount}
            onChange={e => setForm({ ...form, principalAmount: e.target.value })}
            placeholder="80000"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Monthly EMI (₹)</label>
          <input
            type="number" required
            value={form.monthlyAmount}
            onChange={e => setForm({ ...form, monthlyAmount: e.target.value })}
            placeholder="7200"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Tenure (months)</label>
          <input
            type="number" required
            value={form.tenureMonths}
            onChange={e => setForm({ ...form, tenureMonths: e.target.value })}
            placeholder="12"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Interest Rate % (optional)</label>
          <input
            type="number" step="0.01"
            value={form.interestRate}
            onChange={e => setForm({ ...form, interestRate: e.target.value })}
            placeholder="9.5"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Start Date</label>
        <input
          type="date" required
          value={form.startDate}
          onChange={e => setForm({ ...form, startDate: e.target.value })}
          className={inputClass}
        />
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
          ) : 'Add EMI'}
        </button>
      </div>
    </form>
  );
}

// ─── EMI Card (with collapsible installment list) ────────────────────────────
function EMICard({ emi, index, onMarkPaid, onEditAmount, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = (inst) => {
    setEditingId(inst._id);
    setEditValue(inst.amount);
  };

  const saveEdit = async (installmentId) => {
    const value = Number(editValue);
    if (!value || value <= 0) return;
    await onEditAmount(emi._id, installmentId, value);
    setEditingId(null);
  };

  const paidCount  = emi.installments.filter(i => i.status === 'paid').length;
  const totalCount = emi.installments.length;
  const progress    = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;
  const remaining   = (totalCount - paidCount) * emi.monthlyAmount;

  // Next pending installment, shown at a glance
  const nextDue = emi.installments.find(i => i.status === 'pending');

  return (
    <div
      className="bg-white rounded-2xl border border-skylight/30 shadow-sm overflow-hidden animate-fadeIn transition-all duration-300 hover:shadow-md"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* ── Header ── */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-ocean truncate">{emi.title}</p>
              {emi.status === 'closed' && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-200">
                  Closed
                </span>
              )}
            </div>
            <p className="text-xs text-bluebird mt-0.5">
              {emi.loanType === 'credit_card'
                ? `${emi.cardId?.cardName || 'Card'} — ${emi.cardId?.bankName || ''}`
                : (emi.lenderName || 'Loan')}
            </p>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-skylight/20 text-blueberry whitespace-nowrap capitalize">
            {emi.loanType === 'credit_card' ? 'Card EMI' : 'Loan'}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-skylight/20 rounded-full h-1.5 mb-2.5">
          <div
            className="h-1.5 rounded-full bg-blueberry transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-bluebird/70 mb-4">
          <span>{paidCount} of {totalCount} paid</span>
          <span>{progress}%</span>
        </div>

        {/* Numbers row */}
        <div className="grid grid-cols-3 text-xs mb-4">
          <div>
            <p className="text-bluebird/70">Monthly EMI</p>
            <p className="text-ocean font-semibold mt-0.5">{formatCurrency(emi.monthlyAmount)}</p>
          </div>
          <div className="text-center">
            <p className="text-bluebird/70">Remaining</p>
            <p className="text-ocean font-semibold mt-0.5">{formatCurrency(remaining)}</p>
          </div>
          <div className="text-right">
            <p className="text-bluebird/70">Next Due</p>
            <p className="text-ocean font-semibold mt-0.5">
              {nextDue ? new Date(nextDue.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-1 py-1.5 text-xs font-medium text-ocean border border-skylight/40 rounded-lg hover:bg-skylight/10 transition-colors duration-150 flex items-center justify-center gap-1.5"
          >
            {expanded ? 'Hide' : 'View'} Installments
            <svg className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(emi._id)}
            className="px-4 py-1.5 text-xs font-medium text-red-400 border border-red-100 rounded-lg hover:bg-red-50 transition-colors duration-150"
          >
            Delete
          </button>
        </div>
      </div>

      {/* ── Collapsible installment list ── */}
      {expanded && (
        <div className="border-t border-skylight/20 bg-skylight/5 px-5 py-3 max-h-72 overflow-y-auto">
          <div className="divide-y divide-skylight/15">
            {emi.installments.map(inst => (
              <div key={inst._id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                    inst.status === 'paid'
                      ? 'bg-green-50 text-green-600 border border-green-200'
                      : 'bg-skylight/20 text-bluebird border border-skylight/30'
                  }`}>
                    {inst.installmentNumber}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-ocean">
                      {new Date(inst.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    {inst.status === 'paid' && inst.paidAt && (
                      <p className="text-[10px] text-green-500">
                        Paid {new Date(inst.paidAt).toLocaleDateString('en-IN')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {editingId === inst._id ? (
                    <>
                      <input
                        type="number"
                        autoFocus
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        className="w-20 px-2 py-1 text-xs rounded-lg border border-blueberry/40 bg-white text-ocean focus:outline-none focus:ring-2 focus:ring-blueberry/30"
                      />
                      <button
                        onClick={() => saveEdit(inst._id)}
                        className="px-2 py-1 bg-blueberry text-white text-[10px] font-semibold rounded-lg hover:bg-ocean transition-colors duration-150"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-2 py-1 text-bluebird/60 text-[10px] font-semibold hover:text-ocean transition-colors duration-150"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-ocean">{formatCurrency(inst.amount)}</p>
                      {inst.status === 'pending' && (
                        <button
                          onClick={() => startEdit(inst)}
                          className="text-bluebird/50 hover:text-blueberry transition-colors duration-150"
                          title="Edit amount"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                    </>
                  )}
                  {inst.status === 'pending' ? (
                    <button
                      onClick={() => onMarkPaid(emi._id, inst._id)}
                      className="px-2.5 py-1 bg-green-50 hover:bg-green-100 text-green-600 text-[10px] font-semibold rounded-lg border border-green-200 transition-all duration-200"
                    >
                      ✓ Mark Paid
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 bg-green-50 text-green-600 text-[10px] font-semibold rounded-lg border border-green-200">
                      Paid
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function EMIs() {
  const [emis, setEmis]           = useState([]);
  const [cards, setCards]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]       = useState(false);

  const location = useLocation(); // ← ensures fresh data on every visit

  const fetchData = async () => {
    try {
      const [emiList, cardList] = await Promise.all([getEMIs(), getCards()]);
      setEmis(emiList);
      setCards(cardList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [location.key]);

  const handleAdd = async (form) => {
    setSaving(true);
    try {
      await addEMI({
        ...form,
        principalAmount: Number(form.principalAmount),
        monthlyAmount:   Number(form.monthlyAmount),
        tenureMonths:    Number(form.tenureMonths),
        interestRate:    form.interestRate ? Number(form.interestRate) : 0,
        cardId:          form.loanType === 'credit_card' ? form.cardId : null
      });
      setShowModal(false);
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaid = async (emiId, installmentId) => {
    await markInstallmentPaid(emiId, installmentId);
    fetchData();
  };

  const handleEditAmount = async (emiId, installmentId, amount) => {
    await updateInstallmentAmount(emiId, installmentId, amount);
    fetchData();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this EMI plan? This cannot be undone.')) return;
    await deleteEMI(id);
    fetchData();
  };

  const activeEMIs = emis.filter(e => e.status === 'active');
  const closedEMIs = emis.filter(e => e.status === 'closed');

  const totalMonthlyOutgo = activeEMIs.reduce((sum, e) => sum + e.monthlyAmount, 0);

  const totalRemaining = activeEMIs.reduce((sum, e) => {
    const pendingCount = e.installments.filter(i => i.status === 'pending').length;
    return sum + (pendingCount * e.monthlyAmount);
  }, 0);

  return (
    <Layout>

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-7 animate-fadeIn">
        <div>
          <h2 className="text-xl font-semibold text-ocean">EMIs</h2>
          <p className="text-sm text-bluebird mt-0.5">Track loan and credit card EMIs</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-ocean to-blueberry text-white text-sm font-medium rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add EMI
        </button>
      </div>

      {/* ── Stat boxes ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatBox
          label="Monthly Outgo"
          value={formatCurrency(totalMonthlyOutgo)}
          sub={`${activeEMIs.length} active EMI${activeEMIs.length !== 1 ? 's' : ''}`}
          accent
          delay="0ms"
        />
        <StatBox
          label="Total Remaining"
          value={formatCurrency(totalRemaining)}
          sub="across all active EMIs"
          delay="60ms"
        />
        <StatBox
          label="Closed EMIs"
          value={closedEMIs.length}
          sub="fully paid off"
          delay="120ms"
        />
      </div>

      {/* ── Active EMIs ── */}
      {activeEMIs.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-ocean mb-3 px-1">Active EMIs</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeEMIs.map((emi, index) => (
              <EMICard
                key={emi._id}
                emi={emi}
                index={index}
                onMarkPaid={handleMarkPaid}
                onEditAmount={handleEditAmount}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Closed EMIs ── */}
      {closedEMIs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-ocean mb-3 px-1">Closed EMIs</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {closedEMIs.map((emi, index) => (
              <EMICard
                key={emi._id}
                emi={emi}
                index={index}
                onMarkPaid={handleMarkPaid}
                onEditAmount={handleEditAmount}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {emis.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-24 animate-fadeIn">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-ocean to-blueberry flex items-center justify-center mb-4 shadow-md">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m-6 4h6m-6 4h4m-9-9h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-ocean mb-1">No EMIs yet</p>
          <p className="text-xs text-bluebird/70 mb-4">Add a loan or card EMI to start tracking</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-5 py-2 bg-gradient-to-r from-ocean to-blueberry text-white text-sm font-medium rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
          >
            Add your first EMI →
          </button>
        </div>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <Modal title="Add EMI" onClose={() => setShowModal(false)}>
          <EMIForm
            onSubmit={handleAdd}
            onCancel={() => setShowModal(false)}
            saving={saving}
            cards={cards}
          />
        </Modal>
      )}

    </Layout>
  );
}