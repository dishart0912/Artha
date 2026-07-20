import { useEffect, useState, useMemo } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import TransactionForm from '../components/TransactionForm';
import DetailsPopup from '../components/DetailsPopup';
import { getTransactions, addTransaction, updateTransaction, deleteTransaction } from '../services/transactionService';
import { getCards } from '../services/cardService';
import { getBankAccounts } from '../services/bankAccountService';
import { 
    getCategories, 
    addCategory, 
    deleteCategory, 
    updateCategory, 
    addSubcategory, 
    updateSubcategory, 
    deleteSubcategory,
    bulkDeleteCategories
} from '../services/categoryService';
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

function TxnRow({ txn, index, onEdit, onDelete, onRowClick }) {
    const isInflow = txn.transactionType === 'inflow';
    const accountLabel = txn.accountId
        ? `••${txn.accountId.lastFourDigits || txn.accountId.bankName}`
        : null;

    return (
        <div
            onClick={() => onRowClick(txn)}
            className="px-4 py-3.5 animate-fadeIn hover:bg-skylight/5 transition-colors duration-150 cursor-pointer flex flex-col gap-1.5"
            style={{ animationDelay: `${index * 30}ms` }}
        >
            {/* Top row: Icon, Name, and Amount */}
            <div className="flex items-center justify-between gap-3 min-w-0">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isInflow ? 'bg-emerald-50' : 'bg-red-50'}`}>
                        <svg className={`w-3 h-3 ${isInflow ? 'text-emerald-500' : 'text-red-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            {isInflow
                                ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m-7 7l7-7 7 7" />
                                : <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7l-7 7-7-7" />
                            }
                        </svg>
                    </div>
                    <p className="text-sm font-semibold text-ocean truncate">{txn.name}</p>
                </div>
                <span className={`text-sm font-bold tabular-nums shrink-0 ${isInflow ? 'text-emerald-500' : 'text-red-400'}`}>
                    {isInflow ? '+' : '-'}{formatCurrency(txn.amount)}
                </span>
            </div>

            {/* Bottom row: Meta details, tags, and Action buttons */}
            <div className="flex items-end justify-between gap-3 pl-9.5">
                <div className="min-w-0 flex-1">
                    {/* Date + Mode */}
                    <p className="text-[11px] text-bluebird/60 truncate">
                        {formatDate(txn.date)} · {PAYMENT_LABELS[txn.paymentMode]}
                        {accountLabel && ` · ${accountLabel}`}
                        {txn.cardId?.cardName && ` · ${txn.cardId.cardName}`}
                    </p>
                    
                    {/* Tags */}
                    {(txn.billingStatus || txn.expenseType || txn.mainCategory || txn.category) && (
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
                            {(txn.mainCategory || txn.category) && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-skylight/20 text-bluebird font-medium">
                                    {txn.mainCategory ? `${txn.mainCategory} > ${txn.subCategory}` : txn.category}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex gap-1 shrink-0">
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(txn); }}
                        className="px-2 py-1 text-[11px] font-medium text-ocean border border-skylight/40 rounded-lg hover:bg-skylight/10 transition-colors duration-150"
                    >
                        Edit
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(txn._id); }}
                        className="px-2 py-1 text-[11px] font-medium text-red-400 border border-red-100 rounded-lg hover:bg-red-50 transition-colors duration-150"
                    >
                        Del
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Calendar View ────────────────────────────────────────────────────────────
function CalendarView({ transactions, onDaySelect, selectedDate, selectedMonth, setSelectedMonth }) {
    const today = new Date();
    const [y, m] = selectedMonth.split('-').map(Number);
    const viewYear = y;
    const viewMonth = m - 1;

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
        let newMonth = viewMonth - 1;
        let newYear = viewYear;
        if (newMonth < 0) {
            newMonth = 11;
            newYear -= 1;
        }
        setSelectedMonth(`${newYear}-${String(newMonth + 1).padStart(2, '0')}`);
    };
    const nextMonth = () => {
        let newMonth = viewMonth + 1;
        let newYear = viewYear;
        if (newMonth > 11) {
            newMonth = 0;
            newYear += 1;
        }
        setSelectedMonth(`${newYear}-${String(newMonth + 1).padStart(2, '0')}`);
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Transactions() {
    const [transactions, setTransactions] = useState([]);
    const [cards, setCards]               = useState([]);
    const [accounts, setAccounts]         = useState([]);
    const [categories, setCategories]     = useState([]);
    const [loading, setLoading]           = useState(true);
    const [showModal, setShowModal]       = useState(false);
    const [editingTxn, setEditingTxn]     = useState(null);
    const [formLoading, setFormLoading]   = useState(false);
    const [error, setError]               = useState('');
    const [selectedDetailsItem, setSelectedDetailsItem] = useState(null);

    const [filterType, setFilterType]         = useState('all');
    const [filterMode, setFilterMode]         = useState('all');
    const [filterExpense, setFilterExpense]   = useState('all');
    const [filterBilling, setFilterBilling]   = useState('all');
    const [search, setSearch]                 = useState('');
    const [selectedDate, setSelectedDate]     = useState(null);
    const monthOptions = useMemo(() => getMonthOptions(), []);
    const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
    const [activeTab, setActiveTab]           = useState('list'); // 'list' | 'calendar'
    const [searchParams] = useSearchParams();

    // ── Navigation states for Hierarchical Categories ──
    const [currentView, setCurrentView] = useState('root'); // 'root' | 'main' | 'sub'
    const [selectedMainCategory, setSelectedMainCategory] = useState(null);
    const [selectedSubcategory, setSelectedSubcategory] = useState(null);

    // ── Manage Categories Modal State ──
    const [showManageModal, setShowManageModal] = useState(false);

    const fetchAll = async () => {
        try {
            const [txns, cardList, accountList, catList] = await Promise.all([
                getTransactions(), getCards(), getBankAccounts(), getCategories()
            ]);
            setTransactions(txns);
            setCards(cardList);
            setAccounts(accountList);
            setCategories(catList);
        } catch (err) {
            setError('Failed to load transactions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    useEffect(() => {
        const type        = searchParams.get('type');
        const expenseType = searchParams.get('expenseType');
        const add         = searchParams.get('add');
        if (type) setFilterType(type);
        if (expenseType) setFilterExpense(expenseType);
        if (add === 'true') {
            setShowModal(true);
        }
    }, [searchParams]);

    // ── Filter transactions based on view state & search criteria ──
    const filtered = useMemo(() => {
        return transactions.filter(txn => {
            // Apply category hierarchy filter
            if (currentView === 'sub' && selectedMainCategory && selectedSubcategory) {
                if (txn.mainCategory !== selectedMainCategory.name) return false;
                if (txn.subCategory !== selectedSubcategory) return false;
            }

            // Apply standard search and column filters
            if (filterType     !== 'all' && txn.transactionType !== filterType)     return false;
            if (filterMode     !== 'all' && txn.paymentMode     !== filterMode)     return false;
            if (filterExpense  !== 'all' && txn.expenseType     !== filterExpense)  return false;
            if (filterBilling  !== 'all' && txn.billingStatus   !== filterBilling)  return false;
            if (search.trim() && !txn.name.toLowerCase().includes(search.toLowerCase())) return false;
            if (selectedDate) {
                const txnDate = new Date(txn.date).toISOString().split('T')[0];
                if (txnDate !== selectedDate) return false;
            }
            if (selectedMonth) {
                const [y, m] = selectedMonth.split('-').map(Number);
                const d = new Date(txn.date);
                if (d.getFullYear() !== y || (d.getMonth() + 1) !== m) {
                    return false;
                }
            }
            return true;
        });
    }, [transactions, filterType, filterMode, filterExpense, filterBilling, search, selectedDate, selectedMonth, currentView, selectedMainCategory, selectedSubcategory]);

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

    // ── Dynamic Category Calculations ──
    const getCategoryStats = (mainCatName) => {
        const monthTxns = transactions.filter(txn => {
            if (txn.mainCategory !== mainCatName) return false;
            if (selectedMonth) {
                const [y, m] = selectedMonth.split('-').map(Number);
                const d = new Date(txn.date);
                if (d.getFullYear() !== y || (d.getMonth() + 1) !== m) return false;
            }
            return true;
        });

        let inflow = 0;
        let expense = 0;
        monthTxns.forEach(t => {
            if (t.transactionType === 'inflow') inflow += t.amount;
            else expense += t.amount;
        });

        return { inflow, expense, count: monthTxns.length };
    };

    const getSubcategoryStats = (mainCatName, subCatName) => {
        const subTxns = transactions.filter(txn => {
            if (txn.mainCategory !== mainCatName || txn.subCategory !== subCatName) return false;
            if (selectedMonth) {
                const [y, m] = selectedMonth.split('-').map(Number);
                const d = new Date(txn.date);
                if (d.getFullYear() !== y || (d.getMonth() + 1) !== m) return false;
            }
            return true;
        });

        let total = 0;
        subTxns.forEach(t => {
            if (t.transactionType === 'inflow') total += t.amount;
            else total -= t.amount;
        });
        return { total, count: subTxns.length };
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
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        {currentView === 'root' && (
                            <>
                                <h2 className="text-xl font-semibold text-ocean">Transactions</h2>
                                <p className="text-sm text-bluebird mt-0.5">Browse transactions by Main Category</p>
                            </>
                        )}
                        {currentView === 'main' && selectedMainCategory && (
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => {
                                        setCurrentView('root');
                                        setSelectedMainCategory(null);
                                    }}
                                    className="p-1.5 rounded-lg border border-skylight/40 bg-white hover:bg-skylight/10 text-ocean/70 transition"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                <div>
                                    <p className="text-[10px] text-bluebird/60 font-semibold uppercase tracking-wider">Category</p>
                                    <h2 className="text-xl font-bold text-ocean leading-tight">{selectedMainCategory.name}</h2>
                                </div>
                            </div>
                        )}
                        {currentView === 'sub' && selectedMainCategory && selectedSubcategory && (
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => {
                                        setCurrentView('main');
                                        setSelectedSubcategory(null);
                                    }}
                                    className="p-1.5 rounded-lg border border-skylight/40 bg-white hover:bg-skylight/10 text-ocean/70 transition"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                <div>
                                    <p className="text-[10px] text-bluebird/60 font-semibold uppercase tracking-wider">
                                        {selectedMainCategory.name} &rarr; Subcategory
                                    </p>
                                    <h2 className="text-xl font-bold text-ocean leading-tight">{selectedSubcategory}</h2>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
                        <select
                            value={selectedMonth}
                            onChange={e => {
                                setSelectedMonth(e.target.value);
                                setSelectedDate(null);
                            }}
                            className="flex-1 sm:flex-none px-3 py-2 rounded-xl border border-skylight/40 bg-white text-xs sm:text-sm font-medium text-ocean shadow-sm focus:outline-none focus:ring-2 focus:ring-blueberry/30 transition cursor-pointer"
                        >
                            {monthOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => setShowManageModal(true)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-blueberry/30 text-blueberry text-xs sm:text-sm font-medium rounded-xl hover:bg-blueberry/5 transition-all duration-200"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Manage Categories
                        </button>
                        {currentView === 'sub' && (
                            <button
                                onClick={() => exportTransactionsPDF(filtered, `${selectedMainCategory.name} > ${selectedSubcategory}`, selectedMonth)}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-skylight/40 text-ocean text-xs sm:text-sm font-medium rounded-xl hover:bg-skylight/10 hover:-translate-y-0.5 transition-all duration-200"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                <span className="hidden xs:inline">Export PDF</span>
                                <span className="inline xs:hidden">Export</span>
                            </button>
                        )}
                        <button
                            onClick={openAdd}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-ocean to-blueberry text-white text-xs sm:text-sm font-medium rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                            Add Transaction
                        </button>
                    </div>
                </div>
            </div>

            {/* ── View tabs (Shown only when viewing a subcategory's transactions) ── */}
            {currentView === 'sub' && (
                <div className="flex gap-2 mb-5 animate-fadeIn">
                    {[
                        { key: 'list',     label: 'List View' },
                        { key: 'calendar', label: 'Calendar' },
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
            )}

            {/* ── Error ── */}
            {error && (
                <div className="mb-5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-500 flex items-center gap-2 animate-fadeIn">
                    {error}
                    <button onClick={() => setError('')} className="ml-auto text-red-300 hover:text-red-500">✕</button>
                </div>
            )}

            {/* ── ROOT VIEW: Main Category Cards ── */}
            {currentView === 'root' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-6 animate-fadeIn">
                    {categories.map((cat) => {
                        const stats = getCategoryStats(cat.name);
                        return (
                            <button
                                key={cat._id}
                                onClick={() => {
                                    setSelectedMainCategory(cat);
                                    setCurrentView('main');
                                }}
                                className="group text-left bg-white p-5 rounded-2xl border border-skylight/30 hover:border-blueberry/30 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 flex flex-col justify-between min-h-[140px]"
                            >
                                <div>
                                    <div className="w-9 h-9 rounded-xl bg-skylight/20 text-ocean flex items-center justify-center font-bold text-sm mb-3 group-hover:bg-blueberry group-hover:text-white transition-colors duration-200">
                                        {cat.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <p className="text-sm font-bold text-ocean leading-tight group-hover:text-blueberry transition-colors">{cat.name}</p>
                                </div>
                                <div className="mt-4 pt-3 border-t border-skylight/10 w-full space-y-1">
                                    {stats.inflow > 0 && (
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-bluebird/60">Inflow:</span>
                                            <span className="font-bold text-emerald-500">+{formatCurrency(stats.inflow)}</span>
                                        </div>
                                    )}
                                    {stats.expense > 0 && (
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-bluebird/60">Expense:</span>
                                            <span className="font-bold text-red-400">-{formatCurrency(stats.expense)}</span>
                                        </div>
                                    )}
                                    {stats.count === 0 && (
                                        <p className="text-[10px] text-bluebird/40 italic">No transactions this month</p>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── MAIN VIEW: Category Subcategories unified list ── */}
            {currentView === 'main' && selectedMainCategory && (
                <div className="bg-white rounded-2xl border border-skylight/30 overflow-hidden shadow-sm flex flex-col min-h-[300px] mb-6 animate-fadeIn">
                    <div className="bg-gradient-to-r from-skylight/20 to-white px-5 py-4 border-b border-skylight/20 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blueberry shrink-0" />
                        <h3 className="text-sm font-semibold text-ocean">Subcategories</h3>
                    </div>
                    <div className="p-5 overflow-y-auto flex-1 divide-y divide-skylight/10 space-y-1">
                        {selectedMainCategory.subcategories.length === 0 ? (
                            <p className="text-xs text-bluebird/50 italic text-center py-12">No subcategories added yet.</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 divide-y-0">
                                {selectedMainCategory.subcategories.map(subName => {
                                    const subStats = getSubcategoryStats(selectedMainCategory.name, subName);
                                    return (
                                        <button
                                            key={subName}
                                            onClick={() => {
                                                setSelectedSubcategory(subName);
                                                setCurrentView('sub');
                                            }}
                                            className="w-full text-left py-3.5 px-4 hover:bg-skylight/5 border border-skylight/20 rounded-xl transition flex justify-between items-center group bg-white shadow-sm"
                                        >
                                            <span className="text-xs font-semibold text-ocean group-hover:text-blueberry transition">{subName}</span>
                                            {subStats.count > 0 ? (
                                                <span className={`text-xs font-bold font-mono ${subStats.total >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                                                    {subStats.total >= 0 ? '+' : ''}{formatCurrency(subStats.total)}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-bluebird/40 italic">₹0.00</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── SUBCATEGORY VIEW: Search/Filters & Transactions List ── */}
            {currentView === 'sub' && (
                <>
                    {/* Calendar view */}
                    {activeTab === 'calendar' && (
                        <CalendarView
                            transactions={filtered}
                            onDaySelect={setSelectedDate}
                            selectedDate={selectedDate}
                            selectedMonth={selectedMonth}
                            setSelectedMonth={setSelectedMonth}
                        />
                    )}

                    {/* Search bar */}
                    {activeTab === 'list' && (
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

                    {/* Filters */}
                    {activeTab === 'list' && (
                        <div className="flex flex-wrap gap-2 mb-5 animate-fadeIn">
                            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-1.5 rounded-xl border border-skylight/40 bg-white text-xs font-medium text-ocean/70 focus:outline-none focus:ring-2 focus:ring-blueberry/30 transition">
                                <option value="all">All Types (Inflow/Expense)</option>
                                <option value="inflow">↑ Inflow</option>
                                <option value="expense">↓ Expense</option>
                            </select>

                            <select value={filterMode} onChange={e => setFilterMode(e.target.value)} className="px-3 py-1.5 rounded-xl border border-skylight/40 bg-white text-xs font-medium text-ocean/70 focus:outline-none focus:ring-2 focus:ring-blueberry/30 transition">
                                <option value="all">All Modes</option>
                                <option value="cash">Cash</option>
                                <option value="upi">UPI</option>
                                <option value="credit_card">Credit Card</option>
                                <option value="debit_card">Debit Card</option>
                                <option value="bank_transfer">Bank Transfer</option>
                            </select>

                            {filterType === 'expense' && (
                                <select value={filterExpense} onChange={e => setFilterExpense(e.target.value)} className="px-3 py-1.5 rounded-xl border border-skylight/40 bg-white text-xs font-medium text-ocean/70 focus:outline-none focus:ring-2 focus:ring-blueberry/30 transition">
                                    <option value="all">All Expense Types</option>
                                    <option value="fixed">Fixed</option>
                                    <option value="variable">Variable</option>
                                </select>
                            )}

                            <select value={filterBilling} onChange={e => setFilterBilling(e.target.value)} className="px-3 py-1.5 rounded-xl border border-skylight/40 bg-white text-xs font-medium text-ocean/70 focus:outline-none focus:ring-2 focus:ring-blueberry/30 transition">
                                <option value="all">All Billing</option>
                                <option value="unbilled">Unbilled</option>
                                <option value="billed">Billed</option>
                            </select>

                            {selectedDate && (
                                <button onClick={() => setSelectedDate(null)} className="px-3 py-1.5 rounded-xl bg-blueberry/10 text-blueberry text-xs font-semibold hover:bg-blueberry/20 transition">
                                    ✕ Clear date
                                </button>
                            )}
                        </div>
                    )}

                    {/* Subcategory Summary */}
                    {activeTab === 'list' && (
                        <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-blueberry/10 to-ocean/5 border border-blueberry/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-skylight/20 text-blueberry flex items-center justify-center shrink-0">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-xs text-bluebird/70 font-medium">Subcategory Overview</p>
                                    <p className="text-sm font-bold text-ocean">
                                        Showing results for <span className="text-blueberry font-semibold">"{selectedSubcategory}"</span>
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-4 items-center sm:text-right">
                                {filteredTotals.inflow > 0 && (
                                    <div>
                                        <p className="text-[10px] text-bluebird/60 font-semibold uppercase tracking-wider">Total Received</p>
                                        <p className="text-sm font-extrabold text-emerald-500 tabular-nums">
                                            +{formatCurrency(filteredTotals.inflow)}
                                        </p>
                                    </div>
                                )}
                                {filteredTotals.expense > 0 && (
                                    <div>
                                        <p className="text-[10px] text-bluebird/60 font-semibold uppercase tracking-wider">Total Spent</p>
                                        <p className="text-sm font-extrabold text-red-500 tabular-nums">
                                            -{formatCurrency(filteredTotals.expense)}
                                        </p>
                                    </div>
                                )}
                                <div className="border-l border-skylight/30 pl-4">
                                    <p className="text-[10px] text-bluebird/60 font-semibold uppercase tracking-wider">Net Balance</p>
                                    <p className={`text-base font-extrabold tabular-nums ${filteredTotals.net >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                                        {filteredTotals.net >= 0 ? '+' : ''}{formatCurrency(filteredTotals.net)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Transactions list */}
                    {activeTab === 'list' && (
                        filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 animate-fadeIn bg-white rounded-2xl border border-skylight/30 p-10">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-ocean to-blueberry flex items-center justify-center mb-4 shadow-sm">
                                    <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                </div>
                                <p className="text-sm font-semibold text-ocean mb-1">
                                    No transactions here yet
                                </p>
                                <p className="text-xs text-bluebird/70 mb-4">
                                    Start by adding a transaction for this subcategory.
                                </p>
                                <button onClick={openAdd} className="px-5 py-2 bg-gradient-to-r from-ocean to-blueberry text-white text-sm font-medium rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                                    + Add Transaction
                                </button>
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl border border-skylight/30 shadow-sm overflow-hidden animate-fadeIn divide-y divide-skylight/20">
                                {filtered.map((txn, i) => (
                                    <TxnRow key={txn._id} txn={txn} index={i} onEdit={openEdit} onDelete={handleDelete} onRowClick={setSelectedDetailsItem} />
                                ))}
                            </div>
                        )
                    )}
                </>
            )}

            {/* ── Transaction Add/Edit Modal ── */}
            {showModal && (
                <Modal title={editingTxn ? 'Edit Transaction' : 'Add Transaction'} onClose={closeModal}>
                    <TransactionForm
                        initial={editingTxn}
                        cards={cards}
                        accounts={accounts}
                        onSubmit={handleSubmit}
                        onCancel={closeModal}
                        loading={formLoading}
                        prefillMainCategory={selectedMainCategory?.name}
                        prefillSubCategory={selectedSubcategory}
                        prefillType={selectedDetailsItem?.transactionType || 'expense'}
                    />
                </Modal>
            )}

            {/* ── Details Popup ── */}
            {selectedDetailsItem && (
                <DetailsPopup
                    item={selectedDetailsItem}
                    onClose={() => setSelectedDetailsItem(null)}
                />
            )}

            {/* ── Manage Categories Modal ── */}
            {showManageModal && (
                <ManageCategoriesModal
                    categories={categories}
                    onClose={() => {
                        setShowManageModal(false);
                        fetchAll();
                    }}
                    onCategoriesChanged={(updatedCats) => {
                        setCategories(updatedCats);
                        // If selected main or subcategory is deleted or no longer valid, reset navigation
                        if (selectedMainCategory) {
                            const found = updatedCats.find(c => c._id === selectedMainCategory._id);
                            if (!found) {
                                setCurrentView('root');
                                setSelectedMainCategory(null);
                                setSelectedSubcategory(null);
                            } else {
                                setSelectedMainCategory(found);
                                if (selectedSubcategory) {
                                    if (!found.subcategories.includes(selectedSubcategory)) {
                                        setCurrentView('main');
                                        setSelectedSubcategory(null);
                                    }
                                }
                            }
                        }
                    }}
                    transactions={transactions}
                />
            )}
        </Layout>
    );
}

// ─── Manage Categories Modal Component ─────────────────────────────────────────
function ManageCategoriesModal({ categories, onClose, onCategoriesChanged, transactions }) {
    const [newMainName, setNewMainName] = useState('');
    const [expandedCatId, setExpandedCatId] = useState(null);
    const [editingMainId, setEditingMainId] = useState(null);
    const [editMainName, setEditMainName] = useState('');
    const [error, setError] = useState('');

    // Select Mode (Multi-Select Mode) State
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedMainCats, setSelectedMainCats] = useState(new Set()); // Set of Main Category names
    const [selectedSubcats, setSelectedSubcats] = useState(new Set()); // Set of JSON-strings of { mainCategory, subName }
    const [bulkDeleteIssues, setBulkDeleteIssues] = useState([]);

    // Reassignment states for single deletion
    const [reassignmentPrompt, setReassignmentPrompt] = useState(null); // { type: 'main'|'sub', targetName, targetSubName }
    const [reassignToVal, setReassignToVal] = useState('');

    // Subcategory inputs & edits
    const [newSubName, setNewSubName] = useState('');
    const [editingSub, setEditingSub] = useState(null); // { catId, subName, value }

    const clearStates = () => {
        setError('');
        setReassignmentPrompt(null);
        setReassignToVal('');
        setBulkDeleteIssues([]);
    };

    const toggleSelectMode = () => {
        setIsSelectMode(!isSelectMode);
        setSelectedMainCats(new Set());
        setSelectedSubcats(new Set());
        clearStates();
    };

    const handleMainCheckboxChange = (catName, checked) => {
        const next = new Set(selectedMainCats);
        if (checked) {
            next.add(catName);
        } else {
            next.delete(catName);
        }
        setSelectedMainCats(next);
    };

    const handleSubCheckboxChange = (mainCatName, subName, checked) => {
        const next = new Set(selectedSubcats);
        const subKey = JSON.stringify({ mainCategory: mainCatName, subName });
        if (checked) {
            next.add(subKey);
        } else {
            next.delete(subKey);
        }
        setSelectedSubcats(next);
    };

    const handleBulkDelete = async () => {
        clearStates();
        const mainArr = Array.from(selectedMainCats);
        const subArr = Array.from(selectedSubcats).map(s => JSON.parse(s));

        if (mainArr.length === 0 && subArr.length === 0) {
            setError('Please select at least one category or subcategory.');
            return;
        }

        const countText = `${mainArr.length} main category(ies) and ${subArr.length} subcategory(ies)`;
        if (window.confirm(`Are you sure you want to bulk delete the selected ${countText}?`)) {
            try {
                await bulkDeleteCategories(mainArr, subArr);
                const updated = await getCategories();
                onCategoriesChanged(updated);
                // Clear selection
                setSelectedMainCats(new Set());
                setSelectedSubcats(new Set());
                setIsSelectMode(false);
            } catch (err) {
                if (err.response?.data?.issues) {
                    setBulkDeleteIssues(err.response.data.issues);
                } else {
                    setError(err.response?.data?.message || 'Bulk delete failed.');
                }
            }
        }
    };

    const handleAddMain = async (e) => {
        e.preventDefault();
        const trimmed = newMainName.trim();
        if (!trimmed) return;
        try {
            await addCategory(trimmed);
            const updated = await getCategories();
            onCategoriesChanged(updated);
            setNewMainName('');
            clearStates();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to add main category');
        }
    };

    const handleStartEditMain = (cat) => {
        setEditingMainId(cat._id);
        setEditMainName(cat.name);
    };

    const handleSaveEditMain = async (cat) => {
        const trimmed = editMainName.trim();
        if (!trimmed || trimmed === cat.name) {
            setEditingMainId(null);
            return;
        }
        try {
            await updateCategory(cat.name, trimmed);
            const updated = await getCategories();
            onCategoriesChanged(updated);
            setEditingMainId(null);
            clearStates();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update category');
        }
    };

    const handleDeleteMainClick = async (cat) => {
        clearStates();
        // Check transactions
        const hasTxns = transactions.some(t => t.mainCategory === cat.name);
        if (hasTxns) {
            setReassignmentPrompt({
                type: 'main',
                targetName: cat.name
            });
            // Pre-select first available other category
            const remaining = categories.filter(c => c.name !== cat.name);
            setReassignToVal(remaining[0]?.name || '');
        } else {
            if (window.confirm(`Are you sure you want to delete category "${cat.name}"?`)) {
                try {
                    await deleteCategory(cat.name);
                    const updated = await getCategories();
                    onCategoriesChanged(updated);
                } catch (err) {
                    setError(err.response?.data?.message || 'Delete failed');
                }
            }
        }
    };

    const handleConfirmDeleteMain = async () => {
        if (!reassignToVal) {
            setError('Please select a category for reassignment.');
            return;
        }
        try {
            await deleteCategory(reassignmentPrompt.targetName, reassignToVal);
            const updated = await getCategories();
            onCategoriesChanged(updated);
            clearStates();
        } catch (err) {
            setError(err.response?.data?.message || 'Delete with reassignment failed');
        }
    };

    // Subcategory logic
    const handleAddSub = async (cat) => {
        const name = newSubName.trim();
        if (!name) return;
        try {
            await addSubcategory(cat.name, name);
            const updated = await getCategories();
            onCategoriesChanged(updated);
            setNewSubName('');
            clearStates();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to add subcategory');
        }
    };

    const handleSaveSubEdit = async (cat) => {
        const { subName, value } = editingSub;
        const trimmed = value.trim();
        if (!trimmed || trimmed === subName) {
            setEditingSub(null);
            return;
        }
        try {
            await updateSubcategory(cat.name, subName, trimmed);
            const updated = await getCategories();
            onCategoriesChanged(updated);
            setEditingSub(null);
            clearStates();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to rename subcategory');
        }
    };

    const handleDeleteSubClick = async (cat, subName) => {
        clearStates();
        const hasTxns = transactions.some(t => t.mainCategory === cat.name && t.subCategory === subName);
        
        if (hasTxns) {
            setReassignmentPrompt({
                type: 'sub',
                targetName: cat.name,
                targetSubName: subName
            });
            const remaining = cat.subcategories.filter(s => s !== subName);
            setReassignToVal(remaining[0] || '');
        } else {
            if (window.confirm(`Are you sure you want to delete subcategory "${subName}"?`)) {
                try {
                    await deleteSubcategory(cat.name, subName);
                    const updated = await getCategories();
                    onCategoriesChanged(updated);
                } catch (err) {
                    setError(err.response?.data?.message || 'Delete failed');
                }
            }
        }
    };

    const handleConfirmDeleteSub = async () => {
        if (!reassignToVal) {
            setError('Please select a subcategory for reassignment.');
            return;
        }
        const { targetName, targetSubName } = reassignmentPrompt;
        try {
            await deleteSubcategory(targetName, targetSubName, reassignToVal);
            const updated = await getCategories();
            onCategoriesChanged(updated);
            clearStates();
        } catch (err) {
            setError(err.response?.data?.message || 'Delete with reassignment failed');
        }
    };

    const inputCls = `px-3.5 py-2 rounded-xl border border-skylight/40 bg-white text-xs text-ocean placeholder-bluebird/30 focus:outline-none focus:ring-2 focus:ring-blueberry/20 transition`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-ocean/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col animate-scaleIn border border-skylight/20 z-10">
                
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-skylight/20 shrink-0">
                    <div>
                        <h3 className="text-sm font-semibold text-ocean">Category Management</h3>
                        <p className="text-[11px] text-bluebird/60 mt-0.5">Manage Main Categories and Subcategories</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-bluebird/60 hover:bg-skylight/20 hover:text-ocean transition">✕</button>
                </div>

                {/* Main Body */}
                <div className="overflow-y-auto flex-1 p-5 space-y-4">
                    {error && (
                        <div className="px-4 py-2.5 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-500 flex items-center justify-between">
                            <span>{error}</span>
                            <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-600">✕</button>
                        </div>
                    )}

                    {bulkDeleteIssues.length > 0 && (
                        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-xs text-rose-600 space-y-2 animate-fadeIn max-h-[150px] overflow-y-auto">
                            <p className="font-bold">Delete Blocked: The following items contain transactions and cannot be bulk deleted:</p>
                            <ul className="list-disc pl-4 space-y-1">
                                {bulkDeleteIssues.map((issue, idx) => (
                                    <li key={idx}>{issue}</li>
                                ))}
                            </ul>
                            <p className="mt-2 text-[10px] text-rose-500 italic">Please manually edit or delete each item individually to reassign transactions first.</p>
                        </div>
                    )}

                    {/* Reassignment overlay section for single category deletes */}
                    {reassignmentPrompt && (
                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-2xl text-xs text-yellow-800 space-y-3 animate-fadeIn">
                            <p className="font-semibold">
                                {reassignmentPrompt.type === 'main' 
                                    ? `Category "${reassignmentPrompt.targetName}" has transactions. Reassign them to:`
                                    : `Subcategory "${reassignmentPrompt.targetSubName}" has transactions. Reassign to:`}
                            </p>
                            <div className="flex gap-2">
                                <select 
                                    value={reassignToVal} 
                                    onChange={e => setReassignToVal(e.target.value)}
                                    className="flex-1 px-3 py-1.5 rounded-xl border border-yellow-300 bg-white text-xs"
                                >
                                    {reassignmentPrompt.type === 'main' ? (
                                        categories.filter(c => c.name !== reassignmentPrompt.targetName).map(c => (
                                            <option key={c._id} value={c.name}>{c.name}</option>
                                        ))
                                    ) : (
                                        (() => {
                                            const cat = categories.find(c => c.name === reassignmentPrompt.targetName);
                                            const subList = cat?.subcategories || [];
                                            return subList.filter(s => s !== reassignmentPrompt.targetSubName).map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ));
                                        })()
                                    )}
                                </select>
                                <button 
                                    onClick={reassignmentPrompt.type === 'main' ? handleConfirmDeleteMain : handleConfirmDeleteSub}
                                    className="px-4 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl font-semibold transition"
                                >
                                    Confirm Delete
                                </button>
                                <button 
                                    onClick={clearStates}
                                    className="px-3 py-1.5 border border-yellow-300 hover:bg-yellow-100 text-yellow-700 rounded-xl transition"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Mode Select Form */}
                    <div className="flex justify-between items-center bg-skylight/10 p-3 rounded-2xl border border-skylight/30">
                        <span className="text-xs text-ocean/80 font-semibold">Select Mode</span>
                        <button 
                            onClick={toggleSelectMode}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition ${
                                isSelectMode 
                                    ? 'bg-blueberry/10 border-blueberry text-blueberry'
                                    : 'bg-white border-skylight/50 text-ocean/60 hover:text-ocean'
                            }`}
                        >
                            {isSelectMode ? 'Cancel Selection' : 'Enable Select Mode'}
                        </button>
                    </div>

                    {!isSelectMode && (
                        /* Add Main Category Form (Hidden in select mode) */
                        <form onSubmit={handleAddMain} className="flex gap-2 shrink-0">
                            <input
                                type="text"
                                value={newMainName}
                                onChange={e => setNewMainName(e.target.value)}
                                placeholder="New Main Category name..."
                                className={`${inputCls} flex-1`}
                                required
                            />
                            <button type="submit" className="px-4 py-2 bg-gradient-to-r from-ocean to-blueberry text-white text-xs font-semibold rounded-xl hover:shadow shadow-sm transition">
                                + Add Main
                            </button>
                        </form>
                    )}

                    {/* Main Categories list */}
                    <div className="space-y-3">
                        {categories.map((cat) => {
                            const isExpanded = expandedCatId === cat._id;
                            const isEditing = editingMainId === cat._id;
                            const isMainChecked = selectedMainCats.has(cat.name);

                            return (
                                <div key={cat._id} className="border border-skylight/30 bg-skylight/5 rounded-2xl overflow-hidden transition-all duration-200">
                                    <div className="flex items-center justify-between px-4 py-3 bg-white">
                                        <div className="flex-1 min-w-0 mr-3 flex items-center gap-3">
                                            {isSelectMode && cat.name !== 'Others' && (
                                                <input 
                                                    type="checkbox"
                                                    checked={isMainChecked}
                                                    onChange={e => handleMainCheckboxChange(cat.name, e.target.checked)}
                                                    className="rounded border-skylight/50 text-blueberry focus:ring-blueberry/20"
                                                />
                                            )}
                                            {isEditing ? (
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={editMainName}
                                                        onChange={e => setEditMainName(e.target.value)}
                                                        className={`${inputCls} py-1 text-xs`}
                                                        autoFocus
                                                    />
                                                    <button onClick={() => handleSaveEditMain(cat)} className="text-emerald-500 font-bold text-[10px] hover:underline">Save</button>
                                                    <button onClick={() => setEditingMainId(null)} className="text-bluebird font-semibold text-[10px] hover:underline">Cancel</button>
                                                </div>
                                            ) : (
                                                <p className="text-xs font-bold text-ocean truncate">{cat.name}</p>
                                            )}
                                        </div>

                                        {!isSelectMode && (
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button 
                                                    onClick={() => handleStartEditMain(cat)}
                                                    className="p-1 text-bluebird/60 hover:text-ocean transition"
                                                    title="Rename"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                </button>
                                                {cat.name !== 'Others' && (
                                                    <button 
                                                        onClick={() => handleDeleteMainClick(cat)}
                                                        className="p-1 text-rose-400 hover:text-rose-600 transition"
                                                        title="Delete Category"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                                )}
                                                <button 
                                                    onClick={() => setExpandedCatId(isExpanded ? null : cat._id)}
                                                    className="px-2 py-1 bg-skylight/10 rounded-lg text-ocean/60 text-[10px] font-semibold hover:bg-skylight/20 transition flex items-center gap-1"
                                                >
                                                    <span>Subcategories</span>
                                                    <svg className={`w-2.5 h-2.5 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                                </button>
                                            </div>
                                        )}
                                        {isSelectMode && (
                                            <button 
                                                onClick={() => setExpandedCatId(isExpanded ? null : cat._id)}
                                                className="px-2 py-1 bg-skylight/10 rounded-lg text-ocean/60 text-[10px] font-semibold hover:bg-skylight/20 transition flex items-center gap-1 shrink-0"
                                            >
                                                <span>Subcategories</span>
                                                <svg className={`w-2.5 h-2.5 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                            </button>
                                        )}
                                    </div>

                                    {/* Expanded Category Subcategories */}
                                    {isExpanded && (
                                        <div className="p-4 border-t border-skylight/20 bg-skylight/10 space-y-3 animate-fadeIn">
                                            <div className="space-y-1.5">
                                                {cat.subcategories.map(sub => {
                                                    const isSubEditing = editingSub?.catId === cat._id && editingSub?.subName === sub;
                                                    const subKey = JSON.stringify({ mainCategory: cat.name, subName: sub });
                                                    const isSubChecked = selectedSubcats.has(subKey);

                                                    return (
                                                        <div key={sub} className="flex justify-between items-center bg-white px-2.5 py-1.5 rounded-xl border border-skylight/20 text-[11px] min-h-[36px]">
                                                            {isSubEditing ? (
                                                                <div className="flex gap-1.5 flex-1 min-w-0">
                                                                    <input 
                                                                        type="text" 
                                                                        value={editingSub.value}
                                                                        onChange={e => setEditingSub(prev => ({ ...prev, value: e.target.value }))}
                                                                        className="flex-1 bg-skylight/5 border border-skylight/40 px-2 py-0.5 rounded text-[11px]"
                                                                        autoFocus
                                                                    />
                                                                    <button onClick={() => handleSaveSubEdit(cat)} className="text-emerald-500 font-bold">Save</button>
                                                                    <button onClick={() => setEditingSub(null)} className="text-bluebird font-semibold">Cancel</button>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="flex items-center gap-2 flex-1 min-w-0 mr-3">
                                                                        {isSelectMode && sub !== 'Others' && (
                                                                            <input 
                                                                                type="checkbox"
                                                                                checked={isSubChecked}
                                                                                onChange={e => handleSubCheckboxChange(cat.name, sub, e.target.checked)}
                                                                                className="rounded border-skylight/50 text-blueberry focus:ring-blueberry/20"
                                                                            />
                                                                        )}
                                                                        <span className="text-ocean font-medium truncate">{sub}</span>
                                                                    </div>
                                                                    {!isSelectMode && (
                                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                                            <button onClick={() => setEditingSub({ catId: cat._id, subName: sub, value: sub })} className="text-bluebird hover:text-ocean font-medium">Edit</button>
                                                                            {sub !== 'Others' && (
                                                                                <button onClick={() => handleDeleteSubClick(cat, sub)} className="text-rose-400 hover:text-rose-600 font-medium">Delete</button>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {!isSelectMode && (
                                                /* Add Subcategory input (Hidden in select mode) */
                                                <div className="flex gap-2 pt-1 border-t border-skylight/20">
                                                    <input
                                                        type="text"
                                                        value={newSubName}
                                                        onChange={e => setNewSubName(e.target.value)}
                                                        placeholder="New subcategory..."
                                                        className={`${inputCls} flex-1 py-1 text-[11px]`}
                                                    />
                                                    <button onClick={() => handleAddSub(cat)} className="px-3 py-1 bg-gradient-to-r from-ocean to-blueberry text-white font-semibold rounded-lg text-[10px] transition">Add</button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3.5 border-t border-skylight/20 shrink-0 bg-skylight/5 flex justify-between items-center">
                    <div>
                        {isSelectMode && (selectedMainCats.size > 0 || selectedSubcats.size > 0) && (
                            <button 
                                onClick={handleBulkDelete}
                                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-xl shadow-sm hover:shadow transition"
                            >
                                Delete Selected ({selectedMainCats.size + selectedSubcats.size})
                            </button>
                        )}
                    </div>
                    <button onClick={onClose} className="px-4 py-2 bg-gradient-to-r from-ocean to-blueberry text-white text-xs font-semibold rounded-xl shadow-sm hover:shadow transition">
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}