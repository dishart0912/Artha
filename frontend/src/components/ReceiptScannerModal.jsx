import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { getCategories, predictCategory } from '../services/categoryService';
import { formatCurrency } from '../utils/format';

export default function ReceiptScannerModal({ 
    isOpen, 
    onClose, 
    categories = [], 
    accounts = [], 
    cards = [], 
    onSuccess 
}) {
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scanError, setScanError] = useState('');
    const [scanResult, setScanResult] = useState(null);

    // Dynamic User Categories state
    const [userCategories, setUserCategories] = useState(categories || []);
    const [predictingRows, setPredictingRows] = useState({});

    // Fetch user categories if not supplied via props
    useEffect(() => {
        if (categories && categories.length > 0) {
            setUserCategories(categories);
        } else {
            getCategories()
                .then(res => setUserCategories(res || []))
                .catch(err => console.error("Failed to load categories in modal", err));
        }
    }, [categories]);

    // Batch insertion settings
    const [paymentMode, setPaymentMode] = useState('upi');
    const [bankAccountId, setBankAccountId] = useState('');
    const [cardId, setCardId] = useState('');
    const [expenseType, setExpenseType] = useState('variable');
    const [storeName, setStoreName] = useState('Swiggy Instamart');
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const selected = e.target.files[0];
        if (!selected) return;

        setFile(selected);
        setScanError('');
        setScanResult(null);

        if (selected.type.startsWith('image/')) {
            setPreviewUrl(URL.createObjectURL(selected));
        } else {
            setPreviewUrl(null);
        }
    };

    const handleScanReceipt = async () => {
        if (!file) {
            setScanError('Please select or drop a receipt file first.');
            return;
        }

        setIsScanning(true);
        setScanError('');

        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await api.post('/api/categories/scan-receipt', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (res.data && res.data.success) {
                setScanResult(res.data.items || []);
            } else {
                setScanError(res.data.message || 'Unable to read items from this bill.');
            }
        } catch (err) {
            console.error('Receipt Scan Error:', err);
            setScanError(err.response?.data?.message || err.response?.data?.error || 'Could not process the receipt. Please try another file.');
        } finally {
            setIsScanning(false);
        }
    };

    const getSubcategoriesFor = (mainCatName) => {
        const found = userCategories.find(c => c.name === mainCatName);
        if (found && found.subcategories && found.subcategories.length > 0) {
            return found.subcategories;
        }
        return ['Others'];
    };

    const predictItemCategory = async (index, descToPredict) => {
        const text = descToPredict !== undefined ? descToPredict : scanResult?.[index]?.description;
        if (!text || text.trim().length < 2) return;

        setPredictingRows(prev => ({ ...prev, [index]: true }));
        try {
            const res = await predictCategory(text.trim());
            if (res && (res.mainCategory || res.subCategory)) {
                setScanResult(prev => {
                    if (!prev) return prev;
                    const copy = [...prev];
                    const main = res.mainCategory || copy[index]?.mainCategory || 'Home';
                    const sub = res.subCategory || copy[index]?.subCategory || 'Groceries';
                    copy[index] = {
                        ...copy[index],
                        mainCategory: main,
                        subCategory: sub,
                        confidence: res.confidence || 0.85
                    };
                    return copy;
                });
            }
        } catch (err) {
            console.warn('Failed to auto-match category for item:', err);
        } finally {
            setPredictingRows(prev => ({ ...prev, [index]: false }));
        }
    };

    const handleItemChange = (index, field, value) => {
        if (!scanResult) return;
        const updated = [...scanResult];
        updated[index][field] = value;
        setScanResult(updated);
    };

    const handleDescriptionChange = (index, value) => {
        handleItemChange(index, 'description', value);

        // Debounced category re-matching when user edits description
        if (!window.itemPredictTimers) window.itemPredictTimers = {};
        if (window.itemPredictTimers[index]) {
            clearTimeout(window.itemPredictTimers[index]);
        }

        window.itemPredictTimers[index] = setTimeout(() => {
            if (value && value.trim().length >= 2) {
                predictItemCategory(index, value);
            }
        }, 600);
    };

    const handleRemoveItem = (index) => {
        if (!scanResult) return;
        const updated = scanResult.filter((_, i) => i !== index);
        setScanResult(updated);
    };

    const handleAddItem = () => {
        const defaultMain = userCategories[0]?.name || 'Home';
        const defaultSub = userCategories[0]?.subcategories?.[0] || 'Groceries';
        const newItem = {
            description: 'New Item',
            amount: 0.00,
            quantity: 1,
            mainCategory: defaultMain,
            subCategory: defaultSub,
            confidence: 1.00
        };
        setScanResult(prev => [...(prev || []), newItem]);
    };

    const handleBatchSave = async () => {
        if (!scanResult || scanResult.length === 0) return;

        setIsSaving(true);
        try {
            await api.post('/api/transactions/batch', {
                items: scanResult,
                paymentMode,
                bankAccountId: paymentMode !== 'credit_card' ? bankAccountId : null,
                cardId: paymentMode === 'credit_card' ? cardId : null,
                expenseType,
                storeName,
                date: new Date().toISOString()
            });

            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Batch Save Error:', err);
            setScanError(err.response?.data?.message || 'Failed to save items to Artha.');
        } finally {
            setIsSaving(false);
        }
    };

    const totalBillSum = scanResult 
        ? scanResult.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
        : 0;

    return (
        <div className="fixed inset-0 bg-ocean/70 backdrop-blur-md flex items-center justify-center z-50 p-4 sm:p-6 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-skylight/30 animate-scaleIn">
                
                {/* Header */}
                <div className="bg-gradient-to-r from-ocean via-blueberry to-bluebird text-white px-6 py-4.5 flex items-center justify-between shrink-0 shadow-md">
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-xl shrink-0 shadow-inner">
                            🧾
                        </div>
                        <div>
                            <h3 className="margin-0 text-lg font-bold tracking-tight text-white flex items-center gap-2">
                                Smart Receipt Scanner
                            </h3>
                            <p className="margin-0 text-xs text-skylight/90 font-medium">
                                Extract line items & auto-assign categories from store bills
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all duration-150 text-sm font-semibold"
                        title="Close"
                    >
                        ✕
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto flex-1 bg-white">
                    {scanError && (
                        <div className="p-3.5 mb-5 bg-red-50 border-l-4 border-red-500 rounded-r-xl color-[#991b1b] text-xs font-medium flex items-center gap-2">
                            <span className="text-base">⚠️</span>
                            <div>
                                <strong className="font-semibold text-red-800">Note:</strong> {scanError}
                            </div>
                        </div>
                    )}

                    {!scanResult ? (
                        /* STEP 1: UPLOAD DROPZONE */
                        <div className="space-y-6">
                            <label htmlFor="receipt-file-input" className="block cursor-pointer">
                                <div className="border-2 border-dashed border-skylight/60 hover:border-bluebird rounded-2xl p-8 sm:p-12 text-center bg-clouds/40 hover:bg-clouds/80 transition-all duration-200 flex flex-col items-center justify-center gap-4 group">
                                    {previewUrl ? (
                                        <div className="relative group/preview">
                                            <img 
                                                src={previewUrl} 
                                                alt="Receipt preview" 
                                                className="max-h-52 rounded-xl shadow-md border border-skylight/40 object-contain" 
                                            />
                                            <div className="absolute inset-0 bg-ocean/30 rounded-xl opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                                                Click to Change File
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-16 h-16 rounded-2xl bg-skylight/20 group-hover:bg-bluebird/10 text-bluebird flex items-center justify-center text-3xl transition-transform duration-200 group-hover:scale-105 shadow-inner">
                                            📸
                                        </div>
                                    )}

                                    <div>
                                        <p className="text-base font-semibold text-ocean">
                                            {file ? file.name : 'Drop your grocery bill, store receipt, or invoice PDF here'}
                                        </p>
                                        <p className="text-xs text-ocean/60 mt-1">
                                            Supports Blinkit, Swiggy Instamart, Zepto & store receipts (PDF, PNG, JPG up to 10MB)
                                        </p>
                                    </div>

                                    <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-ocean to-blueberry text-white text-xs font-semibold shadow-md group-hover:shadow-lg transition-all duration-200">
                                        {file ? '🔄 Change File' : '📁 Browse Receipt File'}
                                    </span>
                                </div>
                            </label>
                            <input 
                                id="receipt-file-input"
                                type="file" 
                                accept="image/*,application/pdf"
                                onChange={handleFileChange}
                                className="hidden"
                            />

                            <div className="flex justify-end pt-2">
                                <button
                                    onClick={handleScanReceipt}
                                    disabled={!file || isScanning}
                                    className={`w-full sm:w-auto px-7 py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2.5 shadow-md ${
                                        !file || isScanning 
                                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                                            : 'bg-gradient-to-r from-ocean via-blueberry to-bluebird text-white hover:shadow-lg hover:opacity-95'
                                    }`}
                                >
                                    {isScanning ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Reading Receipt & Extracting Items...
                                        </>
                                    ) : (
                                        <>
                                            ✨ Extract & Read Items
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* STEP 2: REVIEW EXTRACTED ITEMS & BATCH SAVE */
                        <div className="space-y-4">
                            {/* Summary Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-skylight/20">
                                <div>
                                    <h4 className="text-base font-bold text-ocean flex items-center gap-2">
                                        Extracted {scanResult.length} Line Items
                                    </h4>
                                    <p className="text-xs text-ocean/60 mt-0.5">
                                        Review item descriptions, prices, and categories before saving to your transactions
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 self-start sm:self-auto">
                                    <span className="text-xs font-medium text-ocean/60">Bill Total:</span>
                                    <span className="px-3.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold shadow-xs">
                                        {formatCurrency(totalBillSum)}
                                    </span>
                                </div>
                            </div>

                            {/* Batch Config Controls */}
                            <div className="bg-clouds/50 p-4 rounded-xl border border-skylight/30 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                                <div>
                                    <label className="block text-[11px] font-semibold text-ocean/80 mb-1">
                                        Store / Merchant
                                    </label>
                                    <input 
                                        type="text" 
                                        value={storeName} 
                                        onChange={(e) => setStoreName(e.target.value)}
                                        className="w-full px-3 py-1.5 text-xs text-ocean font-medium bg-white border border-skylight/40 rounded-xl focus:outline-none focus:border-bluebird focus:ring-2 focus:ring-bluebird/20"
                                        placeholder="Merchant name"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-ocean/80 mb-1">
                                        Payment Mode
                                    </label>
                                    <select 
                                        value={paymentMode} 
                                        onChange={(e) => setPaymentMode(e.target.value)}
                                        className="w-full px-3 py-1.5 text-xs text-ocean font-medium bg-white border border-skylight/40 rounded-xl focus:outline-none focus:border-bluebird focus:ring-2 focus:ring-bluebird/20"
                                    >
                                        <option value="upi">UPI</option>
                                        <option value="debit_card">Debit Card</option>
                                        <option value="credit_card">Credit Card</option>
                                        <option value="cash">Cash</option>
                                    </select>
                                </div>

                                {paymentMode !== 'credit_card' ? (
                                    <div>
                                        <label className="block text-[11px] font-semibold text-ocean/80 mb-1">
                                            Bank Account
                                        </label>
                                        <select 
                                            value={bankAccountId} 
                                            onChange={(e) => setBankAccountId(e.target.value)}
                                            className="w-full px-3 py-1.5 text-xs text-ocean font-medium bg-white border border-skylight/40 rounded-xl focus:outline-none focus:border-bluebird focus:ring-2 focus:ring-bluebird/20"
                                        >
                                            <option value="">-- Cash / None --</option>
                                            {accounts.map(acc => (
                                                <option key={acc._id} value={acc._id}>{acc.bankName} ({acc.accountType})</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-[11px] font-semibold text-ocean/80 mb-1">
                                            Credit Card
                                        </label>
                                        <select 
                                            value={cardId} 
                                            onChange={(e) => setCardId(e.target.value)}
                                            className="w-full px-3 py-1.5 text-xs text-ocean font-medium bg-white border border-skylight/40 rounded-xl focus:outline-none focus:border-bluebird focus:ring-2 focus:ring-bluebird/20"
                                        >
                                            <option value="">-- Select Credit Card --</option>
                                            {cards.map(card => (
                                                <option key={card._id} value={card._id}>
                                                    {card.cardName || card.name} {card.bankName ? `(${card.bankName})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-[11px] font-semibold text-ocean/80 mb-1">
                                        Expense Type
                                    </label>
                                    <select 
                                        value={expenseType} 
                                        onChange={(e) => setExpenseType(e.target.value)}
                                        className="w-full px-3 py-1.5 text-xs text-ocean font-medium bg-white border border-skylight/40 rounded-xl focus:outline-none focus:border-bluebird focus:ring-2 focus:ring-bluebird/20"
                                    >
                                        <option value="variable">Variable Expense</option>
                                        <option value="fixed">Fixed Expense</option>
                                    </select>
                                </div>
                            </div>

                            {/* Extracted Items Table */}
                            <div className="max-h-[380px] overflow-y-auto border border-skylight/30 rounded-xl shadow-xs bg-white">
                                <table className="w-full border-collapse text-xs">
                                    <thead className="bg-clouds/80 sticky top-0 z-10 border-b border-skylight/30 text-ocean/70 font-semibold">
                                        <tr>
                                            <th className="p-3 text-left w-10">#</th>
                                            <th className="p-3 text-left">Item Description</th>
                                            <th className="p-3 text-left w-28">Amount (₹)</th>
                                            <th className="p-3 text-left">Assigned Category</th>
                                            <th className="p-3 text-center w-14">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-skylight/15">
                                        {scanResult.map((item, idx) => {
                                            const isFee = /fee|tax|charge|gst/i.test(item.description);
                                            const confidence = item.confidence || 0.75;
                                            
                                            // Real-world badge status
                                            let matchBadge = { label: 'Auto-matched', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
                                            if (confidence < 0.80 && confidence >= 0.65) {
                                                matchBadge = { label: 'Suggested', style: 'bg-amber-50 text-amber-700 border-amber-200' };
                                            } else if (confidence < 0.65) {
                                                matchBadge = { label: 'Review Category', style: 'bg-blue-50 text-blue-700 border-blue-200' };
                                            }

                                            return (
                                                <tr key={idx} className={`hover:bg-clouds/30 transition-colors ${isFee ? 'bg-amber-50/30' : ''}`}>
                                                    <td className="p-3 text-ocean/50 font-medium">{idx + 1}</td>
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-2">
                                                            <input 
                                                                type="text" 
                                                                value={item.description} 
                                                                onChange={(e) => handleDescriptionChange(idx, e.target.value)}
                                                                placeholder="Item description..."
                                                                className="w-full px-2.5 py-1.5 text-xs text-ocean font-medium bg-white border border-skylight/30 focus:border-bluebird rounded-lg focus:outline-none focus:ring-1 focus:ring-bluebird/20"
                                                            />
                                                            {isFee && (
                                                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-semibold shrink-0">
                                                                    Fee / Charge
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-3">
                                                        <input 
                                                            type="number" 
                                                            step="0.01"
                                                            value={item.amount} 
                                                            onChange={(e) => handleItemChange(idx, 'amount', e.target.value)}
                                                            className="w-full px-2.5 py-1.5 text-xs font-bold text-ocean bg-white border border-skylight/30 focus:border-bluebird rounded-lg focus:outline-none focus:ring-1 focus:ring-bluebird/20"
                                                        />
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex flex-col gap-1.5">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                {/* Main Category Dropdown */}
                                                                <select 
                                                                    value={item.mainCategory || (userCategories[0]?.name || 'Home')}
                                                                    onChange={(e) => {
                                                                        const newMain = e.target.value;
                                                                        const matchedCat = userCategories.find(c => c.name === newMain);
                                                                        const firstSub = matchedCat?.subcategories?.[0] || 'Others';
                                                                        handleItemChange(idx, 'mainCategory', newMain);
                                                                        handleItemChange(idx, 'subCategory', firstSub);
                                                                    }}
                                                                    className="px-2 py-1 text-xs font-semibold text-ocean bg-white border border-skylight/40 rounded-lg focus:outline-none focus:border-bluebird"
                                                                >
                                                                    {userCategories.map(cat => (
                                                                        <option key={cat._id || cat.name} value={cat.name}>
                                                                            {cat.name}
                                                                        </option>
                                                                    ))}
                                                                </select>

                                                                <span className="text-xs text-skylight">→</span>

                                                                {/* Sub Category Dropdown */}
                                                                <select 
                                                                    value={item.subCategory || 'Groceries'}
                                                                    onChange={(e) => handleItemChange(idx, 'subCategory', e.target.value)}
                                                                    className="px-2 py-1 text-xs font-medium text-ocean bg-white border border-skylight/40 rounded-lg focus:outline-none focus:border-bluebird"
                                                                >
                                                                    {getSubcategoriesFor(item.mainCategory).map(sub => (
                                                                        <option key={sub} value={sub}>
                                                                            {sub}
                                                                        </option>
                                                                    ))}
                                                                </select>

                                                                {/* Smart Match Button */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => predictItemCategory(idx, item.description)}
                                                                    disabled={predictingRows[idx]}
                                                                    title="Refresh auto-category"
                                                                    className={`px-2 py-1 rounded-lg border text-[11px] font-semibold transition-all flex items-center gap-1 ${
                                                                        predictingRows[idx] 
                                                                            ? 'bg-blue-50 border-blue-200 text-blue-500 cursor-wait' 
                                                                            : 'bg-skylight/15 hover:bg-skylight/30 border-skylight/30 text-ocean'
                                                                    }`}
                                                                >
                                                                    {predictingRows[idx] ? 'Matching...' : '🔄 Auto-Match'}
                                                                </button>
                                                            </div>

                                                            {/* User-friendly Match Badge */}
                                                            <div className="flex items-center gap-1.5">
                                                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${matchBadge.style}`}>
                                                                    {matchBadge.label}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <button 
                                                            onClick={() => handleRemoveItem(idx)}
                                                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete item"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Add Item Button */}
                            <div className="flex justify-between items-center pt-1">
                                <button
                                    onClick={handleAddItem}
                                    className="px-3.5 py-1.5 rounded-xl bg-skylight/20 hover:bg-skylight/30 text-ocean text-xs font-semibold transition-colors flex items-center gap-1.5"
                                >
                                    + Add Item Manually
                                </button>
                            </div>

                            {/* Action Buttons */}
                            <div className="pt-4 border-t border-skylight/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                                <button
                                    onClick={() => setScanResult(null)}
                                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white border border-skylight/40 hover:bg-clouds text-ocean text-xs font-semibold transition-colors"
                                >
                                    Upload Another Receipt
                                </button>

                                <button
                                    onClick={handleBatchSave}
                                    disabled={isSaving || scanResult.length === 0}
                                    className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 ${
                                        isSaving || scanResult.length === 0
                                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                            : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white hover:shadow-lg'
                                    }`}
                                >
                                    {isSaving ? 'Saving Transactions...' : `Save ${scanResult.length} Transactions to Artha`}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
