import { useEffect, useState, useMemo } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import TransactionForm from '../components/TransactionForm';
import { getTransactions, addTransaction, updateTransaction, deleteTransaction } from '../services/transactionService';
import { getCards } from '../services/cardService';
import { getBankAccounts } from '../services/bankAccountService';
import { formatCurrency, formatDate } from '../utils/format';
import { exportTransactionsPDF } from '../utils/pdfExport';
import { useSearchParams } from 'react-router-dom';

const PAYMENT_LABELS = {
    cash: 'Cash', upi: 'UPI', credit_card: 'Credit Card',
    debit_card: 'Debit Card', bank_transfer: 'Bank Transfer'
};

// ─── Skeleton ────────────────────────────────────────────────────────────────
function Skeleton({ className }) {
    return <div className={`animate-pulse bg-skylight/30 rounded-xl ${className}`} />;
}

// ─── Filter pill ─────────────────────────────────────────────────────────────
function FilterPill({ active, onClick, children }) {
    return (
        <button
            onClick={onClick}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                active
                    ? 'bg-gradient-to-r from-ocean to-blueberry text-white shadow-sm'
                    : 'bg-white border border-skylight/40 text-ocean/60 hover:border-blueberry/30 hover:text-ocean'
            }`}
        >
            {children}
        </button>
    );
}

// ─── Transaction row ──────────────────────────────────────────────────────────
function TxnRow({ txn, index, onEdit, onDelete }) {
    const isInflow = txn.transactionType === 'inflow';
    const accountLabel = txn.accountId
        ? `••${txn.accountId.lastFourDigits || txn.accountId.bankName}`
        : null;

    return (
        <div
            className="flex items-center justify-between px-4 py-3.5 animate-fadeIn hover:bg-skylight/5 transition-colors duration-150"
            style={{ animationDelay: `${index * 30}ms` }}
        >
            {/* Left */}
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isInflow ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    <svg className={`w-3 h-3 ${isInflow ? 'text-emerald-500' : 'text-red-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        {isInflow
                            ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m-7 7l7-7 7 7" />
                            : <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7l-7 7-7-7" />
                        }
                    </svg>
                </div>

                <div className="min-w-0 flex-1">
                    {/* Name — full width, truncated */}
                    <p className="text-sm font-semibold text-ocean truncate">{txn.name}</p>

                    {/* Date + mode on one line */}
                    <p className="text-[11px] text-bluebird/60 mt-0.5 truncate">
                        {formatDate(txn.date)} · {PAYMENT_LABELS[txn.paymentMode]}
                        {accountLabel && ` · ${accountLabel}`}
                        {txn.cardId?.cardName && ` · ${txn.cardId.cardName}`}
                    </p>

                    {/* Tags on second line — only if they exist */}
                    {(txn.billingStatus || txn.expenseType || txn.category) && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                            {txn.billingStatus && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                    txn.billingStatus === 'unbilled'
                                        ? 'bg-yellow-50 text-yellow-600'
                                        : 'bg-skylight/20 text-bluebird'
                                }`}>
                                    {txn.billingStatus}
                                </span>
                            )}
                            {txn.expenseType && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-skylight/20 text-bluebird font-medium capitalize">
                                    {txn.expenseType}
                                </span>
                            )}
                            {txn.category && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-skylight/20 text-bluebird font-medium">
                                    {txn.category}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-2 ml-3 shrink-0">
                <span className={`text-sm font-bold tabular-nums ${isInflow ? 'text-emerald-500' : 'text-red-400'}`}>
                    {isInflow ? '+' : '-'}{formatCurrency(txn.amount)}
                </span>
                <div className="flex gap-1">
                    <button
                        onClick={() => onEdit(txn)}
                        className="px-2 py-1 text-xs font-medium text-ocean border border-skylight/40 rounded-lg hover:bg-skylight/10 transition-colors duration-150"
                    >
                        Edit
                    </button>
                    <button
                        onClick={() => onDelete(txn._id)}
                        className="px-2 py-1 text-xs font-medium text-red-400 border border-red-100 rounded-lg hover:bg-red-50 transition-colors duration-150"
                    >
                        Del
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Calendar View ────────────────────────────────────────────────────────────
function CalendarView({ transactions, onDaySelect, selectedDate }) {
    const today = new Date();
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const [viewYear, setViewYear]   = useState(today.getFullYear());

    const firstDay  = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const dayMap = useMemo(() => {
        const map = {};
        transactions.forEach(txn => {
            const d = new Date(txn.date);
            if (d.getMonth() === viewMonth && d.getFullYear() === viewYear) {
                const key = d.toISOString().split('T')[0];
                if (!map[key]) map[key] = { total: 0, count: 0, hasInflow: false, hasExpense: false };
                if (txn.transactionType === 'inflow') {
                    map[key].total += txn.amount;
                    map[key].hasInflow = true;
                } else {
                    map[key].total -= txn.amount;
                    map[key].hasExpense = true;
                }
                map[key].count++;
            }
        });
        return map;
    }, [transactions, viewMonth, viewYear]);

    const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };

    return (
        <div className="bg-white rounded-2xl border border-skylight/30 shadow-sm p-5 mb-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} className="w-8 h-8 rounded-lg hover:bg-skylight/20 flex items-center justify-center text-ocean transition">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <p className="text-sm font-semibold text-ocean">{monthLabel}</p>
                <button onClick={nextMonth} className="w-8 h-8 rounded-lg hover:bg-skylight/20 flex items-center justify-center text-ocean transition">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>

            <div className="grid grid-cols-7 mb-1">
                {days.map(d => (
                    <div key={d} className="text-center text-[10px] font-semibold text-bluebird/50 uppercase py-1">{d}</div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
                {[...Array(firstDay)].map((_, i) => <div key={`e${i}`} />)}

                {[...Array(daysInMonth)].map((_, i) => {
                    const day   = i + 1;
                    const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const info  = dayMap[dateKey];
                    const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
                    const isSelected = selectedDate === dateKey;

                    return (
                        <button
                            key={day}
                            onClick={() => onDaySelect(isSelected ? null : dateKey)}
                            className={`
                                relative flex flex-col items-center justify-start pt-1 pb-1 rounded-xl min-h-[52px] transition-all duration-150
                                ${isSelected ? 'bg-blueberry text-white' : isToday ? 'bg-skylight/30' : info ? 'hover:bg-skylight/10' : 'hover:bg-skylight/5'}
                            `}
                        >
                            <span className={`text-xs font-semibold ${isSelected ? 'text-white' : isToday ? 'text-blueberry' : 'text-ocean'}`}>
                                {day}
                            </span>
                            {info && (
                                <div className="flex flex-col items-center gap-0.5 mt-0.5">
                                    <span className={`text-[9px] font-bold tabular-nums ${
                                        isSelected ? 'text-white/90' : info.total >= 0 ? 'text-emerald-500' : 'text-red-400'
                                    }`}>
                                        {info.total >= 0 ? '+' : ''}{Math.abs(info.total) >= 1000
                                            ? `${(info.total / 1000).toFixed(1)}k`
                                            : info.total}
                                    </span>
                                    <div className="flex gap-0.5">
                                        {info.hasInflow  && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white/70' : 'bg-emerald-400'}`} />}
                                        {info.hasExpense && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white/70' : 'bg-red-400'}`} />}
                                    </div>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {selectedDate && dayMap[selectedDate] && (
                <div className="mt-4 pt-4 border-t border-skylight/20">
                    <p className="text-xs font-semibold text-ocean/60 uppercase tracking-wider mb-2">
                        {new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                    </p>
                    <div className="flex gap-4">
                        <div>
                            <p className="text-[10px] text-bluebird/60">Transactions</p>
                            <p className="text-sm font-bold text-ocean">{dayMap[selectedDate].count}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-bluebird/60">Net Amount</p>
                            <p className={`text-sm font-bold ${dayMap[selectedDate].total >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                                {dayMap[selectedDate].total >= 0 ? '+' : ''}{formatCurrency(Math.abs(dayMap[selectedDate].total))}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Card Statement View ──────────────────────────────────────────────────────
function CardStatement({ transactions, cards }) {
    const [selectedCardId, setSelectedCardId] = useState('');

    const cardTxns = useMemo(() => {
        if (!selectedCardId) return [];
        return transactions.filter(t => t.cardId?._id === selectedCardId || t.cardId === selectedCardId);
    }, [transactions, selectedCardId]);

    const billed   = cardTxns.filter(t => t.billingStatus === 'billed');
    const unbilled = cardTxns.filter(t => t.billingStatus === 'unbilled');
    const billedTotal   = billed.reduce((s, t) => s + t.amount, 0);
    const unbilledTotal = unbilled.reduce((s, t) => s + t.amount, 0);

    return (
        <div className="bg-white rounded-2xl border border-skylight/30 shadow-sm p-5 mb-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-sm font-semibold text-ocean">Card Statement View</h3>
                    <p className="text-xs text-bluebird/60 mt-0.5">View billed and unbilled by card</p>
                </div>
                <select
                    value={selectedCardId}
                    onChange={e => setSelectedCardId(e.target.value)}
                    className="text-xs font-semibold text-blueberry border border-skylight/40 rounded-lg px-3 py-1.5 bg-clouds focus:outline-none focus:ring-2 focus:ring-blueberry"
                >
                    <option value="">— Select Card —</option>
                    {cards.map(card => (
                        <option key={card._id} value={card._id}>
                            {card.cardName} ({card.bankName})
                        </option>
                    ))}
                </select>
            </div>

            {!selectedCardId ? (
                <p className="text-xs text-bluebird/50 text-center py-4">Select a card to view its transactions</p>
            ) : cardTxns.length === 0 ? (
                <p className="text-xs text-bluebird/50 text-center py-4">No transactions found for this card</p>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3">
                            <p className="text-[10px] font-semibold text-yellow-600 uppercase tracking-wider mb-1">Unbilled</p>
                            <p className="text-lg font-bold text-yellow-700">{formatCurrency(unbilledTotal)}</p>
                            <p className="text-[10px] text-yellow-600/70 mt-0.5">{unbilled.length} transaction{unbilled.length !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="bg-skylight/20 border border-skylight/30 rounded-xl p-3">
                            <p className="text-[10px] font-semibold text-bluebird uppercase tracking-wider mb-1">Billed</p>
                            <p className="text-lg font-bold text-ocean">{formatCurrency(billedTotal)}</p>
                            <p className="text-[10px] text-bluebird/60 mt-0.5">{billed.length} transaction{billed.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>

                    {unbilled.length > 0 && (
                        <div className="mb-3">
                            <p className="text-[11px] font-semibold text-yellow-600 uppercase tracking-wider mb-2">Unbilled Transactions</p>
                            <div className="divide-y divide-skylight/20 border border-skylight/20 rounded-xl overflow-hidden">
                                {unbilled.map(t => (
                                    <div key={t._id} className="flex items-center justify-between px-4 py-2.5">
                                        <div>
                                            <p className="text-sm font-medium text-ocean">{t.name}</p>
                                            <p className="text-[11px] text-bluebird/60">{formatDate(t.date)}</p>
                                        </div>
                                        <span className="text-sm font-bold text-red-400">-{formatCurrency(t.amount)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {billed.length > 0 && (
                        <div>
                            <p className="text-[11px] font-semibold text-bluebird uppercase tracking-wider mb-2">Billed Transactions</p>
                            <div className="divide-y divide-skylight/20 border border-skylight/20 rounded-xl overflow-hidden">
                                {billed.map(t => (
                                    <div key={t._id} className="flex items-center justify-between px-4 py-2.5">
                                        <div>
                                            <p className="text-sm font-medium text-ocean">{t.name}</p>
                                            <p className="text-[11px] text-bluebird/60">{formatDate(t.date)}</p>
                                        </div>
                                        <span className="text-sm font-bold text-ocean/70">-{formatCurrency(t.amount)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Transactions() {
    const [transactions, setTransactions] = useState([]);
    const [cards, setCards]               = useState([]);
    const [accounts, setAccounts]         = useState([]);
    const [loading, setLoading]           = useState(true);
    const [showModal, setShowModal]       = useState(false);
    const [editingTxn, setEditingTxn]     = useState(null);
    const [formLoading, setFormLoading]   = useState(false);
    const [error, setError]               = useState('');

    const [filterType, setFilterType]         = useState('all');
    const [filterMode, setFilterMode]         = useState('all');
    const [filterExpense, setFilterExpense]   = useState('all');
    const [filterBilling, setFilterBilling]   = useState('all');
    const [filterCategory, setFilterCategory] = useState('all');
    const [search, setSearch]                 = useState('');
    const [selectedDate, setSelectedDate]     = useState(null);
    const [activeTab, setActiveTab]           = useState('list'); // 'list' | 'calendar' | 'cards'
    const [searchParams] = useSearchParams();
    const fetchAll = async () => {
        try {
            const [txns, cardList, accountList] = await Promise.all([
                getTransactions(), getCards(), getBankAccounts()
            ]);
            setTransactions(txns);
            setCards(cardList);
            setAccounts(accountList);
        } catch {
            setError('Failed to load transactions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);
    useEffect(() => {
    const type        = searchParams.get('type');
    const expenseType = searchParams.get('expenseType');
    if (type) setFilterType(type);
    if (expenseType) setFilterExpense(expenseType);
}, [searchParams]);
    // ── Unique categories actually used (built dynamically from data) ─────────
    const uniqueCategories = useMemo(() => {
        const cats = transactions.map(t => t.category).filter(Boolean);
        return [...new Set(cats)].sort();
    }, [transactions]);

    const filtered = useMemo(() => {
        return transactions.filter(txn => {
            if (filterType     !== 'all' && txn.transactionType !== filterType)     return false;
            if (filterMode     !== 'all' && txn.paymentMode     !== filterMode)     return false;
            if (filterExpense  !== 'all' && txn.expenseType     !== filterExpense)  return false;
            if (filterBilling  !== 'all' && txn.billingStatus   !== filterBilling)  return false;
            if (filterCategory !== 'all' && txn.category        !== filterCategory) return false;
            if (search.trim() && !txn.name.toLowerCase().includes(search.toLowerCase())) return false;
            if (selectedDate) {
                const txnDate = new Date(txn.date).toISOString().split('T')[0];
                if (txnDate !== selectedDate) return false;
            }
            return true;
        });
    }, [transactions, filterType, filterMode, filterExpense, filterBilling, filterCategory, search, selectedDate]);

    const filteredTotals = useMemo(() => {
        let inflow = 0;
        let expense = 0;
        filtered.forEach(txn => {
            if (txn.transactionType === 'inflow') {
                inflow += txn.amount;
            } else {
                expense += txn.amount;
            }
        });
        return { inflow, expense, net: inflow - expense };
    }, [filtered]);

    const openAdd    = ()    => { setEditingTxn(null); setShowModal(true); };
    const openEdit   = (txn) => { setEditingTxn(txn);  setShowModal(true); };
    const closeModal = ()    => { setShowModal(false);  setEditingTxn(null); };

    const handleSubmit = async (formData) => {
        setFormLoading(true);
        setError('');
        try {
            if (editingTxn) await updateTransaction(editingTxn._id, formData);
            else await addTransaction(formData);
            await fetchAll();
            closeModal();
        } catch (err) {
            setError(err.response?.data?.message || 'Something went wrong');
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this transaction?')) return;
        try {
            await deleteTransaction(id);
            await fetchAll();
        } catch {
            setError('Failed to delete transaction');
        }
    };

    if (loading) return (
        <Layout>
            <div className="mb-7"><Skeleton className="h-7 w-36 mb-2" /><Skeleton className="h-4 w-28" /></div>
            <div className="flex gap-2 mb-5">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-20" />)}</div>
            <div className="bg-white rounded-2xl border border-skylight/30 overflow-hidden">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 rounded-none border-b border-skylight/20 last:border-0" />)}
            </div>
        </Layout>
    );

    return (
        <Layout>

            {/* ── Header ── */}
            <div className="mb-7 animate-fadeIn">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-ocean">Transactions</h2>
                        <p className="text-sm text-bluebird mt-0.5">
                            {filtered.length} of {transactions.length} shown
                            {selectedDate && <span className="ml-1 text-blueberry font-medium">· {new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                            {search && <span className="ml-1 text-blueberry font-medium">· "{search}"</span>}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => exportTransactionsPDF(filtered)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-skylight/40 text-ocean text-sm font-medium rounded-xl hover:bg-skylight/10 hover:-translate-y-0.5 transition-all duration-200"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Export PDF
                        </button>
                        <button
                            onClick={openAdd}
                            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-ocean to-blueberry text-white text-sm font-medium rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                            Add
                        </button>
                    </div>
                </div>
            </div>

            {/* ── View tabs ── */}
            <div className="flex gap-2 mb-5 animate-fadeIn">
                {[
                    { key: 'list',     label: 'List View' },
                    { key: 'calendar', label: 'Calendar' },
                    { key: 'cards',    label: 'Card Statement' },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => { setActiveTab(tab.key); setSelectedDate(null); }}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150 ${
                            activeTab === tab.key
                                ? 'bg-gradient-to-r from-ocean to-blueberry text-white shadow-sm'
                                : 'bg-white border border-skylight/40 text-ocean/60 hover:text-ocean'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── Calendar view ── */}
            {activeTab === 'calendar' && (
                <CalendarView
                    transactions={transactions}
                    onDaySelect={setSelectedDate}
                    selectedDate={selectedDate}
                />
            )}

            {/* ── Card statement view ── */}
            {activeTab === 'cards' && (
                <CardStatement transactions={transactions} cards={cards} />
            )}

            {/* ── Search (list + calendar) ── */}
            {activeTab !== 'cards' && (
                <div className="relative mb-5 animate-fadeIn">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-bluebird/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                    </svg>
                    <input
                        type="text" value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name or merchant..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-skylight/40 bg-white text-sm text-ocean placeholder-bluebird/30 focus:outline-none focus:ring-2 focus:ring-blueberry/30 transition"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-bluebird/40 hover:text-ocean transition">✕</button>
                    )}
                </div>
            )}

            {/* ── Error ── */}
            {error && (
                <div className="mb-5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-500 flex items-center gap-2">
                    {error}
                    <button onClick={() => setError('')} className="ml-auto text-red-300 hover:text-red-500">✕</button>
                </div>
            )}

            {/* ── Filters (list + calendar) ── */}
            {activeTab !== 'cards' && (
                <div className="flex flex-wrap gap-2 mb-5 animate-fadeIn">
                    <div className="flex gap-1.5">
                        {['all', 'inflow', 'expense'].map(type => (
                            <FilterPill key={type} active={filterType === type} onClick={() => setFilterType(type)}>
                                {type === 'all' ? 'All' : type === 'inflow' ? '↑ Inflow' : '↓ Expense'}
                            </FilterPill>
                        ))}
                    </div>
                    <div className="w-px bg-skylight/40 self-stretch mx-1" />

                    <select value={filterMode} onChange={e => setFilterMode(e.target.value)} className="px-3 py-1.5 rounded-xl border border-skylight/40 bg-white text-xs font-medium text-ocean/70 focus:outline-none focus:ring-2 focus:ring-blueberry/30 transition">
                        <option value="all">All Modes</option>
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="credit_card">Credit Card</option>
                        <option value="debit_card">Debit Card</option>
                        <option value="bank_transfer">Bank Transfer</option>
                    </select>

                    <select value={filterExpense} onChange={e => setFilterExpense(e.target.value)} className="px-3 py-1.5 rounded-xl border border-skylight/40 bg-white text-xs font-medium text-ocean/70 focus:outline-none focus:ring-2 focus:ring-blueberry/30 transition">
                        <option value="all">All Types</option>
                        <option value="fixed">Fixed</option>
                        <option value="variable">Variable</option>
                    </select>

                    <select value={filterBilling} onChange={e => setFilterBilling(e.target.value)} className="px-3 py-1.5 rounded-xl border border-skylight/40 bg-white text-xs font-medium text-ocean/70 focus:outline-none focus:ring-2 focus:ring-blueberry/30 transition">
                        <option value="all">All Billing</option>
                        <option value="unbilled">Unbilled</option>
                        <option value="billed">Billed</option>
                    </select>

                    {/* ── Category filter — built dynamically from used categories ── */}
                    {uniqueCategories.length > 0 && (
                        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-1.5 rounded-xl border border-skylight/40 bg-white text-xs font-medium text-ocean/70 focus:outline-none focus:ring-2 focus:ring-blueberry/30 transition">
                            <option value="all">All Categories</option>
                            {uniqueCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    )}

                    {selectedDate && (
                        <button onClick={() => setSelectedDate(null)} className="px-3 py-1.5 rounded-xl bg-blueberry/10 text-blueberry text-xs font-semibold hover:bg-blueberry/20 transition">
                            ✕ Clear date
                        </button>
                    )}
                </div>
            )}

            {/* ── Category filter sum summary ── */}
            {activeTab !== 'cards' && filterCategory !== 'all' && (
                <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-blueberry/10 to-ocean/5 border border-blueberry/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blueberry/10 flex items-center justify-center text-blueberry shrink-0">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-xs text-bluebird/70 font-medium">Category Summary</p>
                            <p className="text-sm font-bold text-ocean">
                                Showing results for <span className="text-blueberry font-semibold">"{filterCategory}"</span>
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-4 items-center sm:text-right">
                        {filteredTotals.expense === 0 && filteredTotals.inflow === 0 ? (
                            <div>
                                <p className="text-[10px] text-bluebird/60 font-semibold uppercase tracking-wider">Total Amount</p>
                                <p className="text-base font-extrabold text-ocean tabular-nums">
                                    {formatCurrency(0)}
                                </p>
                            </div>
                        ) : (
                            <>
                                {filteredTotals.expense > 0 && (
                                    <div>
                                        <p className="text-[10px] text-bluebird/60 font-semibold uppercase tracking-wider">Total Spent</p>
                                        <p className="text-base font-extrabold text-red-500 tabular-nums">
                                            {formatCurrency(filteredTotals.expense)}
                                        </p>
                                    </div>
                                )}
                                {filteredTotals.inflow > 0 && (
                                    <div>
                                        <p className="text-[10px] text-bluebird/60 font-semibold uppercase tracking-wider">Total Received</p>
                                        <p className="text-base font-extrabold text-emerald-500 tabular-nums">
                                            {formatCurrency(filteredTotals.inflow)}
                                        </p>
                                    </div>
                                )}
                                {filteredTotals.expense > 0 && filteredTotals.inflow > 0 && (
                                    <div className="border-l border-skylight/30 pl-4">
                                        <p className="text-[10px] text-bluebird/60 font-semibold uppercase tracking-wider">Net Amount</p>
                                        <p className={`text-base font-extrabold tabular-nums ${filteredTotals.net >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                            {filteredTotals.net >= 0 ? '+' : ''}{formatCurrency(filteredTotals.net)}
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ── Transaction list (list + calendar) ── */}
            {activeTab !== 'cards' && (
                filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 animate-fadeIn">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-ocean to-blueberry flex items-center justify-center mb-4 shadow-md">
                            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        </div>
                        <p className="text-sm font-semibold text-ocean mb-1">
                            {transactions.length === 0 ? 'No transactions yet' : selectedDate ? 'No transactions on this day' : 'No matches'}
                        </p>
                        <p className="text-xs text-bluebird/70 mb-4">
                            {transactions.length === 0 ? 'Start by adding your first transaction' : 'Try adjusting your filters'}
                        </p>
                        {transactions.length === 0 && (
                            <button onClick={openAdd} className="px-5 py-2 bg-gradient-to-r from-ocean to-blueberry text-white text-sm font-medium rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                                Add your first transaction →
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-skylight/30 shadow-sm overflow-hidden animate-fadeIn divide-y divide-skylight/20">
                        {filtered.map((txn, i) => (
                            <TxnRow key={txn._id} txn={txn} index={i} onEdit={openEdit} onDelete={handleDelete} />
                        ))}
                    </div>
                )
            )}

            {/* ── Modal ── */}
            {showModal && (
                <Modal title={editingTxn ? 'Edit Transaction' : 'Add Transaction'} onClose={closeModal}>
                    <TransactionForm
                        initial={editingTxn}
                        cards={cards}
                        accounts={accounts}
                        allTransactions={transactions}
                        onSubmit={handleSubmit}
                        onCancel={closeModal}
                        loading={formLoading}
                    />
                </Modal>
            )}
        </Layout>
    );
}