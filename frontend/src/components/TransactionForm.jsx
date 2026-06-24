import { useState, useEffect } from 'react';
import { getCategories, addCategory, deleteCategory, updateCategory } from '../services/categoryService';

// Payment modes that require a bank account to be linked
const BANK_LINKED_MODES = ['upi', 'debit_card', 'bank_transfer'];

const defaultForm = {
    name: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMode: 'upi',
    transactionType: 'expense',
    accountId: '',
    cardId: '',
    expenseType: 'variable',
    category: ''
};

export default function TransactionForm({ initial, cards = [], accounts = [], allTransactions = [], onSubmit, onCancel, loading, onCategoryDeleted, onCategoryUpdated }) {
    const [form, setForm] = useState(defaultForm);

    // ── Seed form when editing ────────────────────────────────────────────────
    useEffect(() => {
        if (initial) {
            setForm({
                name:            initial.name            || '',
                amount:          initial.amount          || '',
                date:            initial.date
                                    ? new Date(initial.date).toISOString().split('T')[0]
                                    : new Date().toISOString().split('T')[0],
                paymentMode:     initial.paymentMode     || 'upi',
                transactionType: initial.transactionType || 'expense',
                accountId:       initial.accountId?._id  || initial.accountId || '',
                cardId:          initial.cardId?._id     || initial.cardId    || '',
                expenseType:     initial.expenseType     || 'variable',
                category:        initial.category        || ''
            });
        } else {
            setForm(defaultForm);
        }
    }, [initial]);

    const [categories, setCategories] = useState([]);
    const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isEditingCategory, setIsEditingCategory] = useState(false);
    const [editCategoryName, setEditCategoryName] = useState('');

    // Fetch user categories from database
    useEffect(() => {
        const loadCategories = async () => {
            try {
                const res = await getCategories();
                setCategories(res.map(c => c.name));
            } catch (err) {
                console.error("Failed to load categories", err);
            }
        };
        loadCategories();
    }, []);

    // ── Build category suggestions: DB categories + currently selected category if it's not in the list ──
    const suggestedCategories = [...new Set([...categories, form.category])].filter(Boolean).sort();

    const handleAddCategorySubmit = async () => {
        const trimmed = newCategoryName.trim();
        if (trimmed) {
            try {
                await addCategory(trimmed);
                setCategories(prev => [...new Set([...prev, trimmed])].sort());
                setForm(prev => ({ ...prev, category: trimmed }));
            } catch (err) {
                console.error("Failed to add category", err);
            }
        }
        setIsAddingNewCategory(false);
        setNewCategoryName('');
    };

    const handleDeleteCategory = async () => {
        const categoryToDelete = form.category;
        if (!categoryToDelete) return;

        if (window.confirm(`Are you sure you want to delete the category "${categoryToDelete}"? This will clear it from all transactions and recurring expenses.`)) {
            try {
                await deleteCategory(categoryToDelete);
                setCategories(prev => prev.filter(c => c !== categoryToDelete));
                setForm(prev => ({ ...prev, category: '' }));
                if (onCategoryDeleted) {
                    onCategoryDeleted(categoryToDelete);
                }
            } catch (err) {
                console.error("Failed to delete category", err);
            }
        }
    };

    const handleNewCategoryKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddCategorySubmit();
        }
    };

    const handleEditCategorySubmit = async () => {
        const oldName = form.category;
        const newName = editCategoryName?.trim();
        if (!oldName || !newName || oldName === newName) {
            setIsEditingCategory(false);
            return;
        }

        try {
            await updateCategory(oldName, newName);
            setCategories(prev => prev.map(c => c === oldName ? newName : c).sort());
            setForm(prev => ({ ...prev, category: newName }));
            setIsEditingCategory(false);
            if (onCategoryUpdated) {
                onCategoryUpdated(oldName, newName);
            }
        } catch (err) {
            console.error("Failed to edit category", err);
        }
    };

    const handleEditCategoryKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleEditCategorySubmit();
        }
    };

    // ── Derived flags ─────────────────────────────────────────────────────────
    const showAccountDropdown = BANK_LINKED_MODES.includes(form.paymentMode);
    const showCardDropdown    = form.paymentMode === 'credit_card';
    const showExpenseFields   = form.transactionType === 'expense';

    // ── Clear irrelevant linked IDs when payment mode switches ────────────────
    const handlePaymentModeChange = (mode) => {
        setForm(prev => ({
            ...prev,
            paymentMode: mode,
            accountId: BANK_LINKED_MODES.includes(mode) ? prev.accountId : '',
            cardId:    mode === 'credit_card'            ? prev.cardId    : ''
        }));
    };

    const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

    const handleSubmit = (e) => {
        e.preventDefault();
        const payload = {
            name:            form.name.trim(),
            amount:          parseFloat(form.amount),
            date:            form.date,
            paymentMode:     form.paymentMode,
            transactionType: form.transactionType,
            accountId:       showAccountDropdown ? (form.accountId || null) : null,
            cardId:          showCardDropdown    ? (form.cardId    || null) : null,
            expenseType:     showExpenseFields   ? form.expenseType         : null,
            category:        showExpenseFields   ? (form.category?.trim() || null) : null
        };
        onSubmit(payload);
    };

    // ── Shared input class ─────────────────────────────────────────────────────
    const inputCls = `w-full px-3.5 py-2.5 rounded-xl border border-skylight/40 bg-white
                      text-sm text-ocean placeholder-bluebird/30
                      focus:outline-none focus:ring-2 focus:ring-blueberry/30 transition`;

    const labelCls = `block text-xs font-semibold text-bluebird/70 mb-1.5 uppercase tracking-wide`;

    return (
        <form onSubmit={handleSubmit} className="space-y-4">

            {/* ── Name ── */}
            <div>
                <label className={labelCls}>Transaction Name</label>
                <input
                    type="text"
                    value={form.name}
                    onChange={set('name')}
                    placeholder="e.g. Swiggy order, Salary credit"
                    className={inputCls}
                    required
                />
            </div>

            {/* ── Amount + Date ── */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>Amount (₹)</label>
                    <input
                        type="number"
                        value={form.amount}
                        onChange={set('amount')}
                        placeholder="0.00"
                        min="0.01"
                        step="0.01"
                        className={inputCls}
                        required
                    />
                </div>
                <div>
                    <label className={labelCls}>Date</label>
                    <input
                        type="date"
                        value={form.date}
                        onChange={set('date')}
                        className={inputCls}
                        required
                    />
                </div>
            </div>

            {/* ── Transaction Type ── */}
            <div>
                <label className={labelCls}>Type</label>
                <div className="grid grid-cols-2 gap-2">
                    {['expense', 'inflow'].map(type => (
                        <button
                            key={type}
                            type="button"
                            onClick={() => setForm(prev => ({ ...prev, transactionType: type }))}
                            className={`py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                                form.transactionType === type
                                    ? type === 'expense'
                                        ? 'bg-red-50 border-2 border-red-300 text-red-500'
                                        : 'bg-emerald-50 border-2 border-emerald-300 text-emerald-600'
                                    : 'border border-skylight/40 text-bluebird/60 hover:border-blueberry/30'
                            }`}
                        >
                            {type === 'expense' ? '↓ Expense' : '↑ Inflow'}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Payment Mode ── */}
            <div>
                <label className={labelCls}>Payment Mode</label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {[
                        { value: 'upi',           label: 'UPI' },
                        { value: 'debit_card',     label: 'Debit' },
                        { value: 'bank_transfer',  label: 'Transfer' },
                        { value: 'cash',           label: 'Cash' },
                        { value: 'credit_card',    label: 'Credit' }
                    ].map(({ value, label }) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => handlePaymentModeChange(value)}
                            className={`py-2 rounded-xl text-xs font-semibold transition-all duration-150 ${
                                form.paymentMode === value
                                    ? 'bg-gradient-to-r from-ocean to-blueberry text-white shadow-sm'
                                    : 'border border-skylight/40 text-bluebird/60 hover:border-blueberry/30 hover:text-ocean'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Bank Account (UPI / Debit / Transfer only) ── */}
            {showAccountDropdown && (
                <div className="animate-fadeIn">
                    <label className={labelCls}>
                        Bank Account
                        <span className="ml-1 text-red-400">*</span>
                    </label>
                    {accounts.length === 0 ? (
                        <div className="px-3.5 py-2.5 rounded-xl border border-yellow-200 bg-yellow-50 text-xs text-yellow-700">
                            No bank accounts found. Add one in the Bank Accounts page first.
                        </div>
                    ) : (
                        <select
                            value={form.accountId}
                            onChange={set('accountId')}
                            className={inputCls}
                            required
                        >
                            <option value="">Select a bank account</option>
                            {accounts.map(acc => (
                                <option key={acc._id} value={acc._id}>
                                    {acc.bankName} – {acc.accountName}
                                    {acc.lastFourDigits ? ` (••${acc.lastFourDigits})` : ''}
                                    {' '} · ₹{acc.balance?.toLocaleString('en-IN') ?? 0}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            )}

            {/* ── Credit Card ── */}
            {showCardDropdown && (
                <div className="animate-fadeIn">
                    <label className={labelCls}>Credit Card</label>
                    {cards.length === 0 ? (
                        <div className="px-3.5 py-2.5 rounded-xl border border-skylight/40 bg-skylight/10 text-xs text-bluebird/60">
                            No credit cards added yet.
                        </div>
                    ) : (
                        <select
                            value={form.cardId}
                            onChange={set('cardId')}
                            className={inputCls}
                        >
                            <option value="">Select a card (optional)</option>
                            {cards.map(card => (
                                <option key={card._id} value={card._id}>
                                    {card.cardName}
                                    {card.bankName ? ` – ${card.bankName}` : ''}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            )}

            {/* ── Expense-only fields ── */}
            {showExpenseFields && (
                <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                    <div>
                        <label className={labelCls}>Expense Type</label>
                        <select
                            value={form.expenseType}
                            onChange={set('expenseType')}
                            className={inputCls}
                        >
                            <option value="variable">Variable</option>
                            <option value="fixed">Fixed</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Category</label>
                        {isAddingNewCategory ? (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newCategoryName}
                                    onChange={e => setNewCategoryName(e.target.value)}
                                    onKeyDown={handleNewCategoryKeyDown}
                                    placeholder="New category name"
                                    className={`${inputCls} flex-1`}
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={handleAddCategorySubmit}
                                    className="px-3 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-xl hover:bg-emerald-100 transition flex items-center justify-center shrink-0"
                                    title="Add Category"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setIsAddingNewCategory(false); setNewCategoryName(''); }}
                                    className="px-3 border border-skylight/40 text-bluebird/60 rounded-xl hover:bg-skylight/10 transition flex items-center justify-center shrink-0"
                                    title="Cancel"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ) : isEditingCategory ? (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={editCategoryName}
                                    onChange={e => setEditCategoryName(e.target.value)}
                                    onKeyDown={handleEditCategoryKeyDown}
                                    placeholder="Category name"
                                    className={`${inputCls} flex-1`}
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={handleEditCategorySubmit}
                                    className="px-3 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-xl hover:bg-emerald-100 transition flex items-center justify-center shrink-0"
                                    title="Save Category"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setIsEditingCategory(false); setEditCategoryName(''); }}
                                    className="px-3 border border-skylight/40 text-bluebird/60 rounded-xl hover:bg-skylight/10 transition flex items-center justify-center shrink-0"
                                    title="Cancel"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <select
                                    value={form.category}
                                    onChange={set('category')}
                                    className={`${inputCls} flex-1`}
                                >
                                    <option value="">Select a category</option>
                                    {suggestedCategories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => setIsAddingNewCategory(true)}
                                    className="px-3 bg-skylight/20 border border-skylight/40 text-ocean rounded-xl hover:bg-skylight/30 hover:border-blueberry/30 transition flex items-center justify-center shrink-0"
                                    title="Add new category"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                    </svg>
                                </button>
                                {form.category && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsEditingCategory(true);
                                                setEditCategoryName(form.category);
                                            }}
                                            className="px-3 bg-blue-50 border border-blue-200 text-blue-600 rounded-xl hover:bg-blue-100 transition flex items-center justify-center shrink-0 animate-fadeIn"
                                            title="Edit selected category"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleDeleteCategory}
                                            className="px-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl hover:bg-rose-100 transition flex items-center justify-center shrink-0 animate-fadeIn"
                                            title="Delete selected category"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Actions ── */}
            <div className="flex gap-2 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 py-2.5 rounded-xl border border-skylight/40 text-sm font-medium text-bluebird/70 hover:bg-skylight/10 transition-colors duration-150"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={loading || (showAccountDropdown && !form.accountId && accounts.length > 0)}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-ocean to-blueberry text-white text-sm font-semibold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none"
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                            Saving…
                        </span>
                    ) : initial ? 'Save Changes' : 'Add Transaction'}
                </button>
            </div>
        </form>
    );
}