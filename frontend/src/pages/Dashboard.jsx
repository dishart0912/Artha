import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { getDashboard } from '../services/dashboardService';
import { formatCurrency } from '../utils/format';
import CardCalendar from '../components/CardCalendar';
import { getCards } from '../services/cardService';
import SpendingChart from '../components/SpendingChart';
import { getTransactions } from '../services/transactionService';

// ─── Inflow Popup ─────────────────────────────────────────────────────────────
function InflowPopup({ data, onClose, monthLabel }) {
  const items = data?.inflowItems || [];

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center px-4 pb-4 md:pb-0">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ocean/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col animate-scaleIn border border-skylight/20">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-skylight/20 shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-ocean">Total Inflow Breakdown</h3>
            <p className="text-xs text-bluebird mt-0.5">{monthLabel}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-bluebird hover:bg-skylight/20 transition">
            ✕
          </button>
        </div>

        {/* Summary pills */}
        <div className="flex gap-3 px-5 py-3 border-b border-skylight/10 bg-skylight/5 shrink-0">
          <div className="flex-1 bg-white rounded-xl px-3 py-2 border border-skylight/30">
            <p className="text-[10px] text-bluebird/60 uppercase tracking-wider font-semibold">
              Transactions
            </p>
            <p className="text-sm font-bold text-ocean mt-0.5">
              {formatCurrency(data?.txnInflow || 0)}
            </p>
          </div>
          <div className="flex-1 bg-white rounded-xl px-3 py-2 border border-skylight/30">
            <p className="text-[10px] text-bluebird/60 uppercase tracking-wider font-semibold">
              Receivables
            </p>
            <p className="text-sm font-bold text-ocean mt-0.5">
              {formatCurrency(data?.receivablesInflow || 0)}
            </p>
          </div>
          <div className="flex-1 bg-blueberry/5 rounded-xl px-3 py-2 border border-blueberry/20">
            <p className="text-[10px] text-blueberry/70 uppercase tracking-wider font-semibold">
              Total
            </p>
            <p className="text-sm font-bold text-blueberry mt-0.5">
              {formatCurrency(data?.totalInflow || 0)}
            </p>
          </div>
        </div>

        {/* Items list */}
        <div className="overflow-y-auto flex-1 divide-y divide-skylight/20">
          {items.length === 0 ? (
            <div className="py-12 text-center text-sm text-bluebird/50">
              No inflow recorded this month
            </div>
          ) : (
            items.map((item, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3.5 hover:bg-skylight/5 transition">
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    item.source === 'receivable' ? 'bg-emerald-50' : 'bg-blueberry/10'
                  }`}>
                    {item.source === 'receivable' ? (
                      <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5 text-blueberry" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m-7 7l7-7 7 7" />
                      </svg>
                    )}
                  </div>

                  {/* Details */}
                  <div>
                    <p className="text-sm font-semibold text-ocean">{item.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-bluebird/60">
                        {new Date(item.date).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short'
                        })}
                      </span>
                      <span className="text-bluebird/30">·</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                        item.source === 'receivable'
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-blueberry/10 text-blueberry'
                      }`}>
                        {item.source === 'receivable' ? 'Receivable' : item.mode?.replace('_', ' ')}
                      </span>
                      {item.category && item.category !== 'Receivable' && (
                        <>
                          <span className="text-bluebird/30">·</span>
                          <span className="text-[10px] text-bluebird/60">{item.category}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Amount */}
                <span className="text-sm font-bold text-emerald-500 tabular-nums">
                  +{formatCurrency(item.amount)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-skylight/20 shrink-0 bg-skylight/5">
          <p className="text-[10px] text-bluebird/40 text-center">
            {items.length} inflow {items.length === 1 ? 'entry' : 'entries'} this month
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent, delay = '0ms', onClick }) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      className={`
        rounded-2xl p-5 shadow-sm border animate-fadeIn
        transition-all duration-300 hover:shadow-md hover:-translate-y-0.5
        ${onClick ? 'cursor-pointer' : ''}
        ${accent
          ? 'bg-gradient-to-br from-ocean to-blueberry border-ocean/20 text-white'
          : 'bg-white border-skylight/30 text-ocean'
        }
      `}
      style={{ animationDelay: delay }}
    >
      <div className="flex items-start justify-between">
        <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${accent ? 'text-skylight/80' : 'text-ocean/50'}`}>
          {label}
        </p>
        {onClick && (
          <svg className={`w-3.5 h-3.5 mt-0.5 ${accent ? 'text-skylight/60' : 'text-bluebird/40'}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )}
      </div>
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

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ className }) {
  return <div className={`animate-pulse bg-skylight/30 rounded-xl ${className}`} />;
}

// ─── Month options ─────────────────────────────────────────────────────────────
function getMonthOptions() {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }
  return options;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData]                 = useState(null);
  const [cards, setCards]               = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [showInflowPopup, setShowInflowPopup] = useState(false);

  const monthOptions = getMonthOptions();
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError('');
      try {
        const [dashboard, cardList, txnList] = await Promise.all([
          getDashboard(selectedMonth),
          getCards(),
          getTransactions()
        ]);
        setData(dashboard);
        setCards(cardList);
        setTransactions(txnList);
      } catch (err) {
        setError('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [location.key, selectedMonth]);

  const goToTransactions = (params) => {
    const search = new URLSearchParams(params).toString();
    navigate(`/transactions?${search}`);
  };

  const monthLabel = monthOptions.find(m => m.value === selectedMonth)?.label
    || new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const [y, m] = selectedMonth.split('-').map(Number);
  const monthStartStr = `${y}-${String(m).padStart(2, '0')}-01`;
  const monthEndStr   = new Date(y, m, 0).toISOString().split('T')[0];

  if (loading) return (
    <Layout>
      <div className="mb-8">
        <Skeleton className="h-7 w-40 mb-2" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
      <Skeleton className="h-64" />
    </Layout>
  );

  if (error) return (
    <Layout>
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
          <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm text-red-400 font-medium">{error}</p>
        <button onClick={() => window.location.reload()}
          className="text-xs text-blueberry hover:underline font-semibold">
          Try again
        </button>
      </div>
    </Layout>
  );

  return (
    <Layout>

      {/* ── Page header ── */}
      <div className="mb-7 animate-fadeIn">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-semibold text-ocean">Dashboard</h2>
            <p className="text-sm text-bluebird mt-0.5">{monthLabel} overview</p>
          </div>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-skylight/40 bg-white text-sm font-medium text-ocean shadow-sm focus:outline-none focus:ring-2 focus:ring-blueberry/30 transition"
          >
            {monthOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {/* Total Inflow — opens popup */}
        <StatCard
          label="Total Inflow"
          value={formatCurrency(data?.totalInflow)}
          sub="tap to see breakdown"
          accent
          delay="0ms"
          onClick={() => setShowInflowPopup(true)}
        />
        <StatCard
          label="Fixed Expenses"
          value={formatCurrency(data?.fixedExpenses)}
          sub="tap to view"
          delay="60ms"
          onClick={() => goToTransactions({
            type: 'expense', expenseType: 'fixed',
            from: monthStartStr, to: monthEndStr
          })}
        />
        <StatCard
          label="Variable Expenses"
          value={formatCurrency(data?.variableExpenses)}
          sub="tap to view"
          delay="120ms"
          onClick={() => goToTransactions({
            type: 'expense', expenseType: 'variable',
            from: monthStartStr, to: monthEndStr
          })}
        />
      </div>

      {/* ── Two-column section ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

        {/* Credit card outstanding */}
        <div className="bg-white rounded-2xl border border-skylight/30 shadow-sm animate-fadeIn overflow-hidden"
          style={{ animationDelay: '180ms' }}>
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-skylight/20">
            <h3 className="text-sm font-semibold text-ocean">Credit Card Outstanding</h3>
            <a href="/cards" className="text-xs text-blueberry font-semibold hover:underline flex items-center gap-1">
              Manage
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
          <div className="px-5 pb-2">
            {data?.cardOutstanding?.length > 0 ? (
              <div className="divide-y divide-skylight/20">
                {data.cardOutstanding.map((card, index) => {
                  const pct        = parseFloat(card.utilization) || 0;
                  const barColor   = pct > 80 ? 'bg-red-400' : pct > 50 ? 'bg-yellow-400' : 'bg-blueberry';
                  const badgeClass = pct > 80 ? 'bg-red-50 text-red-500' : pct > 50 ? 'bg-yellow-50 text-yellow-600' : 'bg-skylight/20 text-blueberry';
                  return (
                    <div key={index} className="py-4">
                      <div className="flex items-start justify-between mb-2.5">
                        <div>
                          <p className="text-sm font-semibold text-ocean leading-none">{card.cardName}</p>
                          <p className="text-xs text-bluebird mt-0.5">{card.bankName}</p>
                        </div>
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${badgeClass}`}>
                          {card.utilization} used
                        </span>
                      </div>
                      <div className="w-full bg-skylight/20 rounded-full h-1.5 mb-3">
                        <div className={`h-1.5 rounded-full transition-all duration-700 ${barColor}`}
                          style={{ width: card.utilization }} />
                      </div>
                      <div className="grid grid-cols-3 text-xs">
                        <div>
                          <p className="text-bluebird/70">Outstanding</p>
                          <p className="text-ocean font-semibold mt-0.5">{formatCurrency(card.outstanding)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-bluebird/70">Limit</p>
                          <p className="text-ocean font-semibold mt-0.5">{formatCurrency(card.creditLimit)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-bluebird/70">Due date</p>
                          <p className="text-ocean font-semibold mt-0.5">Day {card.dueDate}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center">
                <div className="w-10 h-10 rounded-xl bg-skylight/20 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-bluebird/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <p className="text-sm text-bluebird font-medium mb-1">No cards added yet</p>
                <a href="/cards" className="text-blueberry text-xs font-semibold hover:underline">Add your first card →</a>
              </div>
            )}
          </div>
        </div>

        {/* Billing calendar */}
        <div className="animate-fadeIn" style={{ animationDelay: '240ms' }}>
          <CardCalendar cards={cards} />
        </div>

      </div>

      {/* ── Spending chart ── */}
      <div className="animate-fadeIn" style={{ animationDelay: '300ms' }}>
        <SpendingChart transactions={transactions} />
      </div>

      {/* ── Inflow Popup ── */}
      {showInflowPopup && (
        <InflowPopup
          data={data}
          onClose={() => setShowInflowPopup(false)}
          monthLabel={monthLabel}
        />
      )}

    </Layout>
  );
}