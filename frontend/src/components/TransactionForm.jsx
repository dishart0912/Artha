import { useState, useEffect } from 'react';

// Payment modes that require a bank account to be linked
const BANK_LINKED_MODES = ['upi', 'debit_card', 'bank_transfer'];

const CATEGORIES = [
    'Food & Dining', 'Transport', 'Shopping', 'Entertainment',
    'Health', 'Bills & Utilities', 'Education', 'Travel',
    'Groceries', 'Fuel', 'Subscriptions', 'Rent', 'Other'
];

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

export default function TransactionForm({ initial, cards = [], accounts = [], onSubmit, onCancel, loading }) {
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

    // ── Derived flags ─────────────────────────────────────────────────────────
    const showAccountDropdown = BANK_LINKED_MODES.includes(form.paymentMode);
    const showCardDropdown    = form.paymentMode === 'credit_card';
    const showExpenseFields   = form.transactionType === 'expense';

    // ── Clear irrelevant linked IDs when payment mode switches ────────────────
    const handlePaymentModeChange = (mode) => {
        setForm(prev => ({
            ...prev,
            paymentMode: mode,
            // clear account/card when switching away from their modes
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
            category:        showExpenseFields   ? (form.category  || null) : null
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
                        <select
                            value={form.category}
                            onChange={set('category')}
                            className={inputCls}
                        >
                            <option value="">Select category</option>
                            {CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
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