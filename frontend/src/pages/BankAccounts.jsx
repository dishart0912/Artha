import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { getBankAccounts, addBankAccount, updateBankAccount, deleteBankAccount } from '../services/bankAccountService';
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

// ─── Add Bank Account Form ───────────────────────────────────────────────────
function BankAccountForm({ onSubmit, onCancel, saving }) {
  const [form, setForm] = useState({
    bankName: '', accountName: '', lastFourDigits: '', accountType: 'savings', balance: ''
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Bank Name</label>
          <input
            type="text" required
            value={form.bankName}
            onChange={e => setForm({...form, bankName: e.target.value})}
            placeholder="HDFC Bank"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Account Name</label>
          <input
            type="text" required
            value={form.accountName}
            onChange={e => setForm({...form, accountName: e.target.value})}
            placeholder="Business Current"
            className={inputClass}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Last 4 Digits</label>
          <input
            type="text" required
            value={form.lastFourDigits}
            onChange={e => setForm({...form, lastFourDigits: e.target.value})}
            placeholder="4821"
            maxLength={4}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Account Type</label>
          <select
            value={form.accountType}
            onChange={e => setForm({...form, accountType: e.target.value})}
            className={inputClass}
          >
            <option value="savings">Savings</option>
            <option value="current">Current</option>
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>Current Balance (₹)</label>
        <input
          type="number" required
          value={form.balance}
          onChange={e => setForm({...form, balance: e.target.value})}
          placeholder="150000"
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
          ) : 'Add Account'}
        </button>
      </div>
    </form>
  );
}

// ─── Update Balance Modal ────────────────────────────────────────────────────
function UpdateBalanceForm({ account, onSubmit, onCancel, saving }) {
  const [balance, setBalance] = useState(account.balance);

  const inputClass = `
    w-full px-3.5 py-2.5 rounded-xl border border-skylight/40 bg-skylight/10
    text-ocean text-sm placeholder:text-bluebird/40
    focus:outline-none focus:ring-2 focus:ring-blueberry/30 focus:border-blueberry/40
    transition duration-150
  `;
  const labelClass = "block text-[11px] font-semibold text-ocean/50 uppercase tracking-wider mb-1.5";

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(balance);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-skylight/10 rounded-xl p-4 border border-skylight/30">
        <p className="text-xs text-bluebird/70 mb-1">Account</p>
        <p className="text-sm font-semibold text-ocean">{account.bankName} — {account.accountName}</p>
        <p className="text-xs text-bluebird/60">•••• •••• •••• {account.lastFourDigits}</p>
      </div>
      <div>
        <label className={labelClass}>Updated Balance (₹)</label>
        <input
          type="number" required
          value={balance}
          onChange={e => setBalance(e.target.value)}
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
          ) : 'Update Balance'}
        </button>
      </div>
    </form>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function BankAccounts() {
  const [accounts, setAccounts]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editAccount, setEditAccount]   = useState(null);
  const [saving, setSaving]             = useState(false);

  const location = useLocation(); // ← tracks current route visit

  const fetchData = async () => {
    try {
      const data = await getBankAccounts();
      setAccounts(data);
    } finally {
      setLoading(false);
    }
  };

  // ← location.key changes every time you navigate to this page,
  //   so balances are always fresh after adding a transaction elsewhere
  useEffect(() => { fetchData(); }, [location.key]);

  const handleAdd = async (form) => {
    setSaving(true);
    try {
      await addBankAccount(form);
      setShowAddModal(false);
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateBalance = async (balance) => {
    setSaving(true);
    try {
      await updateBankAccount(editAccount._id, { balance: Number(balance) });
      setEditAccount(null);
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this bank account?')) return;
    await deleteBankAccount(id);
    fetchData();
  };

  const totalBalance    = accounts.reduce((s, a) => s + a.balance, 0);
  const savingsBalance  = accounts.filter(a => a.accountType === 'savings').reduce((s, a) => s + a.balance, 0);
  const currentBalance  = accounts.filter(a => a.accountType === 'current').reduce((s, a) => s + a.balance, 0);

  return (
    <Layout>

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-7 animate-fadeIn">
        <div>
          <h2 className="text-xl font-semibold text-ocean">Bank Accounts</h2>
          <p className="text-sm text-bluebird mt-0.5">Track your bank balances</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-ocean to-blueberry text-white text-sm font-medium rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Account
        </button>
      </div>

      {/* ── Stat boxes ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatBox
          label="Total Balance"
          value={formatCurrency(totalBalance)}
          sub={`${accounts.length} account${accounts.length !== 1 ? 's' : ''}`}
          accent
          delay="0ms"
        />
        <StatBox
          label="Savings"
          value={formatCurrency(savingsBalance)}
          sub={`${accounts.filter(a => a.accountType === 'savings').length} accounts`}
          delay="60ms"
        />
        <StatBox
          label="Current"
          value={formatCurrency(currentBalance)}
          sub={`${accounts.filter(a => a.accountType === 'current').length} accounts`}
          delay="120ms"
        />
      </div>

      {/* ── Accounts grid ── */}
      {accounts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accounts.map((account, index) => (
            <div
              key={account._id}
              className="bg-white rounded-2xl border border-skylight/30 shadow-sm p-5 animate-fadeIn transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-ocean">{account.bankName}</p>
                  <p className="text-xs text-bluebird mt-0.5">{account.accountName}</p>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-skylight/20 text-blueberry capitalize">
                  {account.accountType}
                </span>
              </div>

              <p className="text-2xl font-bold text-ocean mb-1">{formatCurrency(account.balance)}</p>

              {account.lastFourDigits && (
                <p className="text-xs text-bluebird/60 mb-4">•••• •••• •••• {account.lastFourDigits}</p>
              )}

              <div className="flex gap-2 pt-3 border-t border-skylight/20">
                <button
                  onClick={() => setEditAccount(account)}
                  className="flex-1 py-1.5 text-xs font-medium text-ocean border border-skylight/40 rounded-lg hover:bg-skylight/10 transition-colors duration-150"
                >
                  Update Balance
                </button>
                <button
                  onClick={() => handleDelete(account._id)}
                  className="flex-1 py-1.5 text-xs font-medium text-red-400 border border-red-100 rounded-lg hover:bg-red-50 transition-colors duration-150"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !loading && (
          <div className="flex flex-col items-center justify-center py-24 animate-fadeIn">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-ocean to-blueberry flex items-center justify-center mb-4 shadow-md">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-ocean mb-1">No bank accounts yet</p>
            <p className="text-xs text-bluebird/70 mb-4">Add your first account to track balances</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-5 py-2 bg-gradient-to-r from-ocean to-blueberry text-white text-sm font-medium rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              Add your first account →
            </button>
          </div>
        )
      )}

      {/* ── Add Modal ── */}
      {showAddModal && (
        <Modal title="Add Bank Account" onClose={() => setShowAddModal(false)}>
          <BankAccountForm
            onSubmit={handleAdd}
            onCancel={() => setShowAddModal(false)}
            saving={saving}
          />
        </Modal>
      )}

      {/* ── Update Balance Modal ── */}
      {editAccount && (
        <Modal title="Update Balance" onClose={() => setEditAccount(null)}>
          <UpdateBalanceForm
            account={editAccount}
            onSubmit={handleUpdateBalance}
            onCancel={() => setEditAccount(null)}
            saving={saving}
          />
        </Modal>
      )}

    </Layout>
  );
}