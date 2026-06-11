import { useEffect, useState, useMemo } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import TransactionForm from '../components/TransactionForm';
import { getTransactions, addTransaction, updateTransaction, deleteTransaction } from '../services/transactionService';
import { getCards } from '../services/cardService';
import { getBankAccounts } from '../services/bankAccountService';
import { formatCurrency, formatDate } from '../utils/format';
import { exportTransactionsPDF } from '../utils/pdfExport';

const PAYMENT_LABELS = {
    cash: 'Cash', upi: 'UPI', credit_card: 'Credit Card',
    debit_card: 'Debit Card', bank_transfer: 'Bank Transfer'
};

// ─── Skeleton ────────────────────────────────────────────────────────────────
function Skeleton({ className }) {
    return <div className={`animate-pulse bg-skylight/30 rounded-xl ${className}`} />;
}

// ─── Filter pill button ───────────────────────────────────────────────────────
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

    // Build a short account label e.g. "HDFC Current (••4242)"
    const accountLabel = txn.accountId
        ? `${txn.accountId.bankName} ${txn.accountId.accountName}${
            txn.accountId.lastFourDigits ? ` (••${txn.accountId.lastFourDigits})` : ''
          }`
        : null;

    return (
        <div
            className="flex items-center justify-between px-5 py-4 animate-fadeIn hover:bg-skylight/5 transition-colors duration-150"
            style={{ animationDelay: `${index * 30}ms` }}
        >
            {/* Left */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Type dot */}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isInflow ? 'bg-emerald-50' : 'bg-red-50'
                }`}>
                    <svg className={`w-3.5 h-3.5 ${isInflow ? 'text-emerald-500' : 'text-red-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        {isInflow
                            ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m-7 7l7-7 7 7" />
                            : <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7l-7 7-7-7" />
                        }
                    </svg>
                </div>

                <div className="min-w-0">
                    <p className="text-sm font-semibold text-ocean truncate">{txn.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-bluebird/60">{formatDate(txn.date)}</span>
                        <span className="text-bluebird/30 text-[11px]">·</span>
                        <span className="text-[11px] text-bluebird/60">{PAYMENT_LABELS[txn.paymentMode]}</span>

                        {/* ── Bank account pill ── */}
                        {accountLabel && (
                            <>
                                <span className="text-bluebird/30 text-[11px]">·</span>
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                                    🏦 {accountLabel}
                                </span>
                            </>
                        )}

                        {/* ── Credit card pill ── */}
                        {txn.cardId?.cardName && (
                            <>
                                <span className="text-bluebird/30 text-[11px]">·</span>
                                <span className="text-[11px] text-bluebird/60">{txn.cardId.cardName}</span>
                            </>
                        )}

                        {txn.billingStatus && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                txn.billingStatus === 'unbilled'
                                    ? 'bg-yellow-50 text-yellow-600'
                                    : 'bg-skylight/20 text-bluebird'
                            }`}>
                                {txn.billingStatus}
                            </span>
                        )}
                        {txn.expenseType && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-skylight/20 text-bluebird font-medium capitalize">
                                {txn.expenseType}
                            </span>
                        )}
                        {txn.category && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-skylight/20 text-bluebird font-medium">
                                {txn.category}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-3 ml-4 shrink-0">
                <span className={`text-sm font-bold tabular-nums ${isInflow ? 'text-emerald-500' : 'text-red-400'}`}>
                    {isInflow ? '+' : '-'}{formatCurrency(txn.amount)}
                </span>
                <div className="flex gap-1.5">
                    <button
                        onClick={() => onEdit(txn)}
                        className="px-2.5 py-1 text-xs font-medium text-ocean border border-skylight/40 rounded-lg hover:bg-skylight/10 transition-colors duration-150"
                    >
                        Edit
                    </button>
                    <button
                        onClick={() => onDelete(txn._id)}
                        className="px-2.5 py-1 text-xs font-medium text-red-400 border border-red-100 rounded-lg hover:bg-red-50 transition-colors duration-150"
                    >
                        Del
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Transactions() {
    const [transactions, setTransactions] = useState([]);
    const [cards, setCards]               = useState([]);
    const [accounts, setAccounts]         = useState([]);   // ← new
    const [loading, setLoading]           = useState(true);
    const [showModal, setShowModal]       = useState(false);
    const [editingTxn, setEditingTxn]     = useState(null);
    const [formLoading, setFormLoading]   = useState(false);
    const [error, setError]               = useState('');

    const [filterType, setFilterType]       = useState('all');
    const [filterMode, setFilterMode]       = useState('all');
    const [filterExpense, setFilterExpense] = useState('all');
    const [search, setSearch]               = useState('');

    const fetchAll = async () => {
        try {
            const [txns, cardList, accountList] = await Promise.all([
                getTransactions(),
                getCards(),
                getBankAccounts()       // ← new
            ]);
            setTransactions(txns);
            setCards(cardList);
            setAccounts(accountList);   // ← new
        } catch {
            setError('Failed to load transactions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    const filtered = useMemo(() => {
        return transactions.filter(txn => {
            if (filterType !== 'all'    && txn.transactionType !== filterType)    return false;
            if (filterMode !== 'all'    && txn.paymentMode     !== filterMode)    return false;
            if (filterExpense !== 'all' && txn.expenseType     !== filterExpense) return false;
            if (search.trim() && !txn.name.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        });
    }, [transactions, filterType, filterMode, filterExpense, search]);

    const openAdd    = ()    => { setEditingTxn(null); setShowModal(true); };
    const openEdit   = (txn) => { setEditingTxn(txn);  setShowModal(true); };
    const closeModal = ()    => { setShowModal(false);  setEditingTxn(null); };

    const handleSubmit = async (formData) => {
        setFormLoading(true);
        setError('');
        try {
            if (editingTxn) await updateTransaction(editingTxn._id, formData);
            else await addTransaction(formData);
            await fetchAll();   // re-fetch so account balances refresh in dropdown
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
            await fetchAll();   // re-fetch so balance in dropdown updates
        } catch {
            setError('Failed to delete transaction');
        }
    };

    // ── Loading skeleton ──
    if (loading) return (
        <Layout>
            <div className="mb-7">
                <Skeleton className="h-7 w-36 mb-2" />
                <Skeleton className="h-4 w-28" />
            </div>
            <div className="flex gap-2 mb-5">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-20" />)}
            </div>
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
                            {search && <span className="ml-1 text-blueberry font-medium">· "{search}"</span>}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => exportTransactionsPDF(filtered)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-skylight/40 text-ocean text-sm font-medium rounded-xl hover:bg-skylight/10 hover:-translate-y-0.5 transition-all duration-200"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Export PDF
                        </button>
                        <button
                            onClick={openAdd}
                            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-ocean to-blueberry text-white text-sm font-medium rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            Add
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Search ── */}
            <div className="relative mb-5 animate-fadeIn">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-bluebird/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name or merchant..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-skylight/40 bg-white text-sm text-ocean placeholder-bluebird/30 focus:outline-none focus:ring-2 focus:ring-blueberry/30 transition"
                />
                {search && (
                    <button
                        onClick={() => setSearch('')}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-bluebird/40 hover:text-ocean transition"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* ── Error ── */}
            {error && (
                <div className="mb-5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-500 flex items-center gap-2 animate-fadeIn">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                    <button onClick={() => setError('')} className="ml-auto text-red-300 hover:text-red-500">✕</button>
                </div>
            )}

            {/* ── Filters ── */}
            <div className="flex flex-wrap gap-2 mb-5 animate-fadeIn" style={{ animationDelay: '60ms' }}>
                {/* Type pills */}
                <div className="flex gap-1.5">
                    {['all', 'inflow', 'expense'].map(type => (
                        <FilterPill key={type} active={filterType === type} onClick={() => setFilterType(type)}>
                            {type === 'all' ? 'All' : type === 'inflow' ? '↑ Inflow' : '↓ Expense'}
                        </FilterPill>
                    ))}
                </div>

                {/* Divider */}
                <div className="w-px bg-skylight/40 self-stretch mx-1" />

                {/* Payment mode */}
                <select
                    value={filterMode}
                    onChange={e => setFilterMode(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-skylight/40 bg-white text-xs font-medium text-ocean/70 focus:outline-none focus:ring-2 focus:ring-blueberry/30 transition"
                >
                    <option value="all">All Modes</option>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="debit_card">Debit Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                </select>

                {/* Expense type */}
                <select
                    value={filterExpense}
                    onChange={e => setFilterExpense(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-skylight/40 bg-white text-xs font-medium text-ocean/70 focus:outline-none focus:ring-2 focus:ring-blueberry/30 transition"
                >
                    <option value="all">All Types</option>
                    <option value="fixed">Fixed</option>
                    <option value="variable">Variable</option>
                </select>
            </div>

            {/* ── List ── */}
            {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 animate-fadeIn">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-ocean to-blueberry flex items-center justify-center mb-4 shadow-md">
                        <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>
                    <p className="text-sm font-semibold text-ocean mb-1">
                        {transactions.length === 0 ? 'No transactions yet' : 'No matches'}
                    </p>
                    <p className="text-xs text-bluebird/70 mb-4">
                        {transactions.length === 0 ? 'Start by adding your first transaction' : 'Try adjusting your filters'}
                    </p>
                    {transactions.length === 0 && (
                        <button
                            onClick={openAdd}
                            className="px-5 py-2 bg-gradient-to-r from-ocean to-blueberry text-white text-sm font-medium rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                        >
                            Add your first transaction →
                        </button>
                    )}
                </div>
            ) : (
                <div
                    className="bg-white rounded-2xl border border-skylight/30 shadow-sm overflow-hidden animate-fadeIn divide-y divide-skylight/20"
                    style={{ animationDelay: '120ms' }}
                >
                    {filtered.map((txn, i) => (
                        <TxnRow
                            key={txn._id}
                            txn={txn}
                            index={i}
                            onEdit={openEdit}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            )}

            {/* ── Modal ── */}
            {showModal && (
                <Modal
                    title={editingTxn ? 'Edit Transaction' : 'Add Transaction'}
                    onClose={closeModal}
                >
                    <TransactionForm
                        initial={editingTxn}
                        cards={cards}
                        accounts={accounts}     // ← new
                        onSubmit={handleSubmit}
                        onCancel={closeModal}
                        loading={formLoading}
                    />
                </Modal>
            )}
        </Layout>
    );
}