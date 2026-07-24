import { useState, useEffect } from 'react';
import { getCategories, predictCategory } from '../services/categoryService';
import { getReceivables } from '../services/receivableService';
import { formatCurrency } from '../utils/format';
import ReceiptScannerModal from './ReceiptScannerModal';

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
    mainCategory: '',
    subCategory: ''
};

export default function TransactionForm({ 
    initial, 
    cards = [], 
    accounts = [], 
    onSubmit, 
    onCancel, 
    loading,
    prefillMainCategory = '',
    prefillSubCategory = '',
    prefillType = ''
}) {
    const [form, setForm] = useState(defaultForm);
    const [categories, setCategories] = useState([]);
    const [pendingReceivables, setPendingReceivables] = useState([]);
    const [loadingReceivables, setLoadingReceivables] = useState(false);
    const [isReceivablePayment, setIsReceivablePayment] = useState(false);
    const [selectedReceivableId, setSelectedReceivableId] = useState('');

    // ── Receipt Scanner Modal state ──────────────────────────────────────────
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

    // ── AI Prediction state ──────────────────────────────────────────────────
    const [isPredicting, setIsPredicting] = useState(false);
    const [aiPrediction, setAiPrediction] = useState(null);

    // ── Seed form when editing or using prefill ────────────────────────────────
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
                mainCategory:    initial.mainCategory    || 'Others',
                subCategory:     initial.subCategory     || 'Others'
            });
        } else {
            setForm({
                ...defaultForm,
                mainCategory: prefillMainCategory || '',
                subCategory: prefillSubCategory || '',
                transactionType: prefillType || 'expense'
            });
        }
    }, [initial, prefillMainCategory, prefillSubCategory, prefillType]);

    // Fetch user categories from database
    useEffect(() => {
        const loadCategories = async () => {
            try {
                const res = await getCategories();
                setCategories(res);
            } catch (err) {
                console.error("Failed to load categories", err);
            }
        };
        loadCategories();
    }, []);

    useEffect(() => {
        if (form.transactionType === 'inflow' && !initial) {
            setLoadingReceivables(true);
            getReceivables()
                .then(data => {
                    const pending = data.filter(r => r.status === 'pending');
                    setPendingReceivables(pending);
                    setLoadingReceivables(false);
                })
                .catch(err => {
                    console.error("Failed to load receivables", err);
                    setLoadingReceivables(false);
                });
        } else {
            setIsReceivablePayment(false);
            setSelectedReceivableId('');
        }
    }, [form.transactionType, initial]);

    const handleReceivableSelect = (receivableId) => {
        setSelectedReceivableId(receivableId);
        if (receivableId) {
            const recv = pendingReceivables.find(r => r._id === receivableId);
            if (recv) {
                setForm(prev => ({
                    ...prev,
                    name: `Payment from ${recv.clientName}`,
                    amount: recv.amount,
                    mainCategory: 'Others',
                    subCategory: 'Receivable'
                }));
            }
        }
    };
    // ── Helper to match AI predicted subCategory with User's actual DB categories ─────
    const matchUserSubCategory = (predictedSub, userCategories) => {
        if (!userCategories || userCategories.length === 0) {
            return { mainCategory: '', subCategory: predictedSub || 'Others' };
        }

        const pSub = (predictedSub || '').toLowerCase();

        // 1. Direct search for subcategory match in user's categories
        for (const cat of userCategories) {
            const subs = cat.subcategories || [];
            for (const sub of subs) {
                const sLower = sub.toLowerCase();
                if (sLower === pSub || sLower.includes(pSub) || pSub.includes(sLower)) {
                    return {
                        mainCategory: cat.name,
                        subCategory: sub
                    };
                }
            }
        }

        // 2. Keyword mapping for common subcategories
        for (const cat of userCategories) {
            const subs = cat.subcategories || [];
            for (const sub of subs) {
                const sLower = sub.toLowerCase();
                if ((pSub.includes('cafe') || pSub.includes('fast food') || pSub.includes('delivery')) && sLower.includes('food')) {
                    return { mainCategory: cat.name, subCategory: sub };
                }
                if ((pSub.includes('cab') || pSub.includes('fuel') || pSub.includes('transit')) && (sLower.includes('travel') || sLower.includes('transport'))) {
                    return { mainCategory: cat.name, subCategory: sub };
                }
                if ((pSub.includes('quick commerce') || pSub.includes('supermarket')) && sLower.includes('grocer')) {
                    return { mainCategory: cat.name, subCategory: sub };
                }
                if ((pSub.includes('online') || pSub.includes('fashion') || pSub.includes('electronic')) && sLower.includes('shopping')) {
                    return { mainCategory: cat.name, subCategory: sub };
                }
            }
        }

        // 3. Fallback to first category
        const firstCat = userCategories[0];
        return {
            mainCategory: firstCat ? firstCat.name : '',
            subCategory: (firstCat?.subcategories || [])[0] || 'Others'
        };
    };

    // ── AI SubCategory Auto-Prediction effect (Debounced) ───────────────────────
    useEffect(() => {
        // Only run for new transactions when name has at least 3 chars
        if (initial || !form.name || form.name.trim().length < 3 || isReceivablePayment) {
            return;
        }

        const timer = setTimeout(async () => {
            try {
                setIsPredicting(true);
                const res = await predictCategory(form.name.trim());
                if (res && (res.subCategory || res.mainCategory)) {
                    const matched = matchUserSubCategory(res.subCategory, categories);
                    const finalMain = res.mainCategory || matched.mainCategory;
                    const finalSub = res.subCategory || matched.subCategory;

                    setAiPrediction(res);
                    setForm(prev => ({
                        ...prev,
                        mainCategory: finalMain,
                        subCategory: finalSub
                    }));
                }
            } catch (err) {
                console.warn("AI Prediction error:", err);
            } finally {
                setIsPredicting(false);
            }
        }, 400); // 400ms debounce

        return () => clearTimeout(timer);
    }, [form.name, initial, isReceivablePayment, categories]);

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
        
        let finalMainCategory = form.mainCategory;
        let finalSubCategory = form.subCategory;
        if (form.transactionType === 'inflow' && isReceivablePayment) {
            finalMainCategory = 'Others';
            finalSubCategory = 'Receivable';
        }

        const payload = {
            name:            form.name.trim(),
            amount:          parseFloat(form.amount),
            date:            form.date,
            paymentMode:     form.paymentMode,
            transactionType: form.transactionType,
            accountId:       showAccountDropdown ? (form.accountId || null) : null,
            cardId:          showCardDropdown    ? (form.cardId    || null) : null,
            expenseType:     showExpenseFields   ? form.expenseType         : null,
            category:        form.transactionType === 'inflow' && isReceivablePayment ? 'Receivable' : (form.subCategory || null),
            mainCategory:    finalMainCategory || 'Others',
            subCategory:     finalSubCategory || 'Others',
            receivableId:    form.transactionType === 'inflow' && isReceivablePayment ? (selectedReceivableId || null) : null
        };
        onSubmit(payload);
    };

    // ── Shared input class ─────────────────────────────────────────────────────
    const inputCls = `w-full px-3.5 py-2.5 rounded-xl border border-skylight/40 bg-white
                      text-sm text-ocean placeholder-bluebird/30
                      focus:outline-none focus:ring-2 focus:ring-blueberry/30 transition`;

    const labelCls = `block text-xs font-semibold text-bluebird/70 mb-1.5 uppercase tracking-wide`;

    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* ── AI Receipt Scanner Banner Button ── */}
                {!initial && (
                    <div className="p-3 rounded-xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">📸</span>
                            <div>
                                <p className="text-xs font-bold text-indigo-900 m-0">Have a physical bill or PDF receipt?</p>
                                <p className="text-[11px] text-indigo-700/80 m-0">Extract items & auto-categorize in seconds</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsReceiptModalOpen(true)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1"
                        >
                            <span>🧾 Scan Bill</span>
                        </button>
                    </div>
                )}

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
                            onClick={() => {
                                setForm(prev => ({
                                    ...prev,
                                    transactionType: type
                                }));
                            }}
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

            {/* ── Receivable Payment check ── */}
            {form.transactionType === 'inflow' && !initial && (
                <div className="bg-skylight/10 border border-skylight/40 rounded-xl p-3.5 space-y-3 animate-fadeIn">
                    <label className="flex items-center gap-2 text-xs font-semibold text-ocean cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isReceivablePayment}
                            onChange={(e) => {
                                setIsReceivablePayment(e.target.checked);
                                if (!e.target.checked) {
                                    setSelectedReceivableId('');
                                }
                            }}
                            className="rounded border-skylight/50 text-blueberry focus:ring-blueberry/30"
                        />
                        Is this payment for a receivable?
                    </label>

                    {isReceivablePayment && (
                        <div className="animate-fadeIn">
                            <label className={labelCls}>Select Receivable</label>
                            {loadingReceivables ? (
                                <p className="text-xs text-bluebird/60">Loading receivables...</p>
                            ) : pendingReceivables.length === 0 ? (
                                <p className="text-xs text-yellow-600 font-medium">No pending receivables found.</p>
                            ) : (
                                <select
                                    value={selectedReceivableId}
                                    onChange={(e) => handleReceivableSelect(e.target.value)}
                                    className={inputCls}
                                    required
                                >
                                    <option value="">— Select Pending Receivable —</option>
                                    {pendingReceivables.map(r => (
                                        <option key={r._id} value={r._id}>
                                            {r.clientName} (Amount: {formatCurrency(r.amount)})
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Category Fields (shown for both Inflow and Expense, except if receivable check is active) ── */}
            {!isReceivablePayment && (
                <div className="space-y-1.5 animate-fadeIn">
                    {/* AI Prediction Status Badge */}
                    <div className="flex items-center justify-between px-1">
                        <span className={labelCls}>Category Classification</span>
                        {isPredicting ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blueberry animate-pulse">
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                </svg>
                                AI Predicting...
                            </span>
                        ) : aiPrediction ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                                ✨ AI Auto-Filled ({Math.round(aiPrediction.confidence * 100)}% match)
                            </span>
                        ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <select
                                value={form.mainCategory}
                                onChange={(e) => {
                                    const newMain = e.target.value;
                                    const catObj = categories.find(c => c.name === newMain);
                                    const subList = catObj ? (catObj.subcategories || []) : [];
                                    const defaultSub = subList.includes('Others') ? 'Others' : (subList[0] || '');
                                    setForm(prev => ({ 
                                        ...prev, 
                                        mainCategory: newMain,
                                        subCategory: defaultSub
                                    }));
                                    setAiPrediction(null); // Clear AI badge if user overrides manually
                                }}
                                className={inputCls}
                                required
                            >
                                <option value="">Select main category</option>
                                {categories.map(c => (
                                    <option key={c._id} value={c.name}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <select
                                value={form.subCategory}
                                onChange={(e) => {
                                    setForm(prev => ({ ...prev, subCategory: e.target.value }));
                                    setAiPrediction(null); // Clear AI badge if user overrides manually
                                }}
                                className={inputCls}
                                required
                                disabled={!form.mainCategory}
                            >
                                <option value="">Select subcategory</option>
                                {(() => {
                                    const catObj = categories.find(c => c.name === form.mainCategory);
                                    if (!catObj) return null;
                                    const subList = catObj.subcategories || [];
                                    return subList.map(sub => (
                                        <option key={sub} value={sub}>{sub}</option>
                                    ));
                                })()}
                            </select>
                        </div>
                    </div>
                </div>
            )}

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

            {/* ── Expense Type (Expense only) ── */}
            {showExpenseFields && (
                <div className="animate-fadeIn">
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

        {/* ── Receipt Scanner Modal Render ── */}
        <ReceiptScannerModal 
            isOpen={isReceiptModalOpen}
            onClose={() => setIsReceiptModalOpen(false)}
            categories={categories}
            accounts={accounts}
            cards={cards}
            onSuccess={() => {
                setIsReceiptModalOpen(false);
                if (onSubmit) onSubmit({ batchInserted: true });
            }}
        />
    </>
    );
}