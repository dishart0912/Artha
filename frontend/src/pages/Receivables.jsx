import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { getReceivables, addReceivable, markReceived, deleteReceivable } from '../services/receivableService';
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

// ─── Add Receivable Form ─────────────────────────────────────────────────────
function ReceivableForm({ onSubmit, onCancel, saving }) {
  const [form, setForm] = useState({ clientName: '', amount: '', description: '', dueDate: '' });

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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Client Name</label>
          <input
            type="text" required
            value={form.clientName}
            onChange={e => setForm({...form, clientName: e.target.value})}
            placeholder="Rajesh Traders"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Amount (₹)</label>
          <input
            type="number" required
            value={form.amount}
            onChange={e => setForm({...form, amount: e.target.value})}
            placeholder="25000"
            className={inputClass}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Description</label>
          <input
            type="text"
            value={form.description}
            onChange={e => setForm({...form, description: e.target.value})}
            placeholder="Invoice #1042"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Due Date</label>
          <input
            type="date"
            value={form.dueDate}
            onChange={e => setForm({...form, dueDate: e.target.value})}
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
          ) : 'Add Receivable'}
        </button>
      </div>
    </form>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function Receivables() {
  const [receivables, setReceivables] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [saving, setSaving]           = useState(false);
  const [search, setSearch] = useState('');
  const fetchData = async () => {
    try {
      const data = await getReceivables();
      setReceivables(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAdd = async (form) => {
    setSaving(true);
    try {
      await addReceivable(form);
      setShowModal(false);
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  const handleMarkReceived = async (id) => {
    await markReceived(id);
    fetchData();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this receivable?')) return;
    await deleteReceivable(id);
    fetchData();
  };

  const allPending  = receivables.filter(r => r.status === 'pending');
const allReceived = receivables.filter(r => r.status === 'received');

const pending  = allPending.filter(r =>
  !search.trim() || r.clientName.toLowerCase().includes(search.toLowerCase())
);
const received = allReceived.filter(r =>
  !search.trim() || r.clientName.toLowerCase().includes(search.toLowerCase())
);
  return (
    <Layout>

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-7 animate-fadeIn">
        <div>
          <h2 className="text-xl font-semibold text-ocean">Receivables</h2>
          <p className="text-sm text-bluebird mt-0.5">Track payments expected from clients</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-ocean to-blueberry text-white text-sm font-medium rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Receivable
        </button>
      </div>

      {/* ── Stat boxes ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatBox
          label="Total Pending"
          value={formatCurrency(allPending.reduce((s, r) => s + r.amount, 0))}
          sub={`${allPending.length} client${allPending.length !== 1 ? 's' : ''}`}
          accent
          delay="0ms"
        />
        <StatBox
          label="Total Received"
          value={formatCurrency(allReceived.reduce((s, r) => s + r.amount, 0))}
          sub={`${allReceived.length} payment${allReceived.length !== 1 ? 's' : ''}`}
          delay="60ms"
        />
        <StatBox
          label="Total Expected"
          value={formatCurrency(receivables.reduce((s, r) => s + r.amount, 0))}
          sub="all time"
          delay="120ms"
        />
      </div>
{/* ── Search ── */}
<div className="relative mb-5 animate-fadeIn">
  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-bluebird/40"
    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
  </svg>
  <input
    type="text"
    value={search}
    onChange={e => setSearch(e.target.value)}
    placeholder="Search by client name..."
    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-skylight/40 bg-white text-sm text-ocean placeholder-bluebird/30 focus:outline-none focus:ring-2 focus:ring-blueberry/30 transition"
  />
  {search && (
    <button
      onClick={() => setSearch('')}
      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-bluebird/40 hover:text-ocean transition text-sm"
    >
      ✕
    </button>
  )}
</div>
      {/* ── Pending list ── */}
      {pending.length > 0 && (
        <div className="bg-white rounded-2xl border border-skylight/30 shadow-sm overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-skylight/20">
            <h3 className="text-sm font-semibold text-ocean">Pending Payments</h3>
          </div>
          <div className="divide-y divide-skylight/20">
            {pending.map(r => (
              <div key={r._id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ocean truncate">{r.clientName}</p>
                  {r.description && <p className="text-xs text-bluebird mt-0.5">{r.description}</p>}
                  {r.dueDate && (
                    <p className="text-xs text-bluebird/60 mt-0.5">
                      Due: {new Date(r.dueDate).toLocaleDateString('en-IN')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className="text-sm font-bold text-ocean">{formatCurrency(r.amount)}</p>
                  <button
                    onClick={() => handleMarkReceived(r._id)}
                    className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-600 text-xs font-semibold rounded-lg border border-green-200 transition-all duration-200"
                  >
                    ✓ Received
                  </button>
                  <button
                    onClick={() => handleDelete(r._id)}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-400 text-xs font-semibold rounded-lg border border-red-200 transition-all duration-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Received list ── */}
      {received.length > 0 && (
        <div className="bg-white rounded-2xl border border-skylight/30 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-skylight/20">
            <h3 className="text-sm font-semibold text-ocean">Received Payments</h3>
          </div>
          <div className="divide-y divide-skylight/20">
            {received.map(r => (
              <div key={r._id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ocean/50 line-through truncate">{r.clientName}</p>
                  {r.description && <p className="text-xs text-bluebird/60 mt-0.5">{r.description}</p>}
                  <p className="text-xs text-green-500 mt-0.5">
                    Received: {new Date(r.receivedAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className="text-sm font-bold text-ocean/50">{formatCurrency(r.amount)}</p>
                  <span className="px-3 py-1.5 bg-green-50 text-green-600 text-xs font-semibold rounded-lg border border-green-200">
                    ✓ Received
                  </span>
                  {/* ← delete button added to received list */}
                  <button
                    onClick={() => handleDelete(r._id)}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-400 text-xs font-semibold rounded-lg border border-red-200 transition-all duration-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {receivables.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-24 animate-fadeIn">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-ocean to-blueberry flex items-center justify-center mb-4 shadow-md">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-ocean mb-1">No receivables yet</p>
          <p className="text-xs text-bluebird/70 mb-4">Add a client payment to start tracking</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-5 py-2 bg-gradient-to-r from-ocean to-blueberry text-white text-sm font-medium rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
          >
            Add your first receivable →
          </button>
        </div>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <Modal title="Add Receivable" onClose={() => setShowModal(false)}>
          <ReceivableForm
            onSubmit={handleAdd}
            onCancel={() => setShowModal(false)}
            saving={saving}
          />
        </Modal>
      )}

    </Layout>
  );
}