import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import { getDashboard } from '../services/dashboardService';
import { formatCurrency } from '../utils/format';
import CardCalendar from '../components/CardCalendar';
import { getCards } from '../services/cardService';
import SpendingChart from '../components/SpendingChart';
import { getTransactions } from '../services/transactionService';

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent, delay = '0ms' }) {
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

// ─── Skeleton ────────────────────────────────────────────────────────────────
function Skeleton({ className }) {
  return <div className={`animate-pulse bg-skylight/30 rounded-xl ${className}`} />;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData]                 = useState(null);
  const [cards, setCards]               = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');

  const location = useLocation(); // ← tracks route visits

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true); // ← reset loading on every navigation
      setError('');
      try {
        const [dashboard, cardList, txnList] = await Promise.all([
          getDashboard(),
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
  }, [location.key]); // ← re-fetches every time you navigate to dashboard

  if (loading) return (
    <Layout>
      <div className="mb-8">
        <Skeleton className="h-7 w-40 mb-2" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6"> {/* ← fixed: was md:grid-cols-4 */}
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
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-blueberry hover:underline font-semibold"
        >
          Try again
        </button>
      </div>
    </Layout>
  );

  return (
    <Layout>

      {/* ── Page header ── */}
      <div className="mb-7 animate-fadeIn">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-ocean">Dashboard</h2>
            <p className="text-sm text-bluebird mt-0.5">
              {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} overview
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-skylight/30 shadow-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-blueberry" />
            <span className="text-xs font-medium text-ocean">
              {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Inflow"      value={formatCurrency(data?.totalInflow)}      sub="this month" accent delay="0ms"   />
        <StatCard label="Fixed Expenses"    value={formatCurrency(data?.fixedExpenses)}                            delay="60ms"  />
        <StatCard label="Variable Expenses" value={formatCurrency(data?.variableExpenses)}                         delay="120ms" />
      </div>

      {/* ── Two-column section ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

        {/* Credit card outstanding */}
        <div
          className="bg-white rounded-2xl border border-skylight/30 shadow-sm animate-fadeIn overflow-hidden"
          style={{ animationDelay: '180ms' }}
        >
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
                        <div className={`h-1.5 rounded-full transition-all duration-700 ${barColor}`} style={{ width: card.utilization }} />
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

    </Layout>
  );
}