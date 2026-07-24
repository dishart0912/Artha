import React, { useState } from 'react';
import api from '../services/api';
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
            setScanError('Please select or drop a receipt image/PDF file first.');
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
                setScanError(res.data.message || 'Scanning failed to extract items.');
            }
        } catch (err) {
            console.error('Receipt Scan Error:', err);
            setScanError(err.response?.data?.message || err.response?.data?.error || 'Failed to connect to receipt scanner service.');
        } finally {
            setIsScanning(false);
        }
    };

    const handleItemChange = (index, field, value) => {
        if (!scanResult) return;
        const updated = [...scanResult];
        updated[index][field] = value;
        setScanResult(updated);
    };

    const handleRemoveItem = (index) => {
        if (!scanResult) return;
        const updated = scanResult.filter((_, i) => i !== index);
        setScanResult(updated);
    };

    const handleAddItem = () => {
        const newItem = {
            description: 'New Item',
            amount: 0.00,
            quantity: 1,
            mainCategory: 'Home',
            subCategory: 'Groceries',
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
            setScanError(err.response?.data?.message || 'Failed to batch save itemized transactions.');
        } finally {
            setIsSaving(false);
        }
    };

    const totalBillSum = scanResult 
        ? scanResult.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
        : 0;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1.5rem'
        }}>
            <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '20px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                width: '100%',
                maxWidth: '900px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                border: '1px solid #e2e8f0'
            }}>
                {/* Modal Header */}
                <div style={{
                    padding: '1.25rem 1.75rem',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.75rem' }}>🧾</span>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                                Smart AI Receipt Scanner
                            </h3>
                            <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.9 }}>
                                Computer Vision OCR + Dynamic Auto-Categorization
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        style={{
                            background: 'rgba(255, 255, 255, 0.2)',
                            border: 'none',
                            color: '#ffffff',
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            fontSize: '1.2rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Modal Body */}
                <div style={{ padding: '1.75rem', overflowY: 'auto', flex: 1 }}>
                    {scanError && (
                        <div style={{
                            padding: '0.85rem 1rem',
                            backgroundColor: '#fef2f2',
                            borderLeft: '4px solid #ef4444',
                            borderRadius: '8px',
                            color: '#991b1b',
                            marginBottom: '1.25rem',
                            fontSize: '0.9rem'
                        }}>
                            <strong>Error:</strong> {scanError}
                        </div>
                    )}

                    {!scanResult ? (
                        /* --- STEP 1: UPLOAD DROPZONE --- */
                        <div>
                            <label htmlFor="receipt-file-input" style={{ cursor: 'pointer' }}>
                                <div style={{
                                    border: '2px dashed #a5b4fc',
                                    borderRadius: '16px',
                                    padding: '3rem 2rem',
                                    textAlign: 'center',
                                    backgroundColor: '#f8fafc',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '1rem'
                                }}>
                                    {previewUrl ? (
                                        <img 
                                            src={previewUrl} 
                                            alt="Receipt preview" 
                                            style={{ maxHeight: '200px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} 
                                        />
                                    ) : (
                                        <div style={{
                                            width: '64px',
                                            height: '64px',
                                            borderRadius: '50%',
                                            backgroundColor: '#e0e7ff',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '2rem'
                                        }}>
                                            📸
                                        </div>
                                    )}

                                    <div>
                                        <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#1e293b' }}>
                                            {file ? file.name : 'Drop your Swiggy, Zepto, Blinkit receipt or PDF here'}
                                        </p>
                                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                                            Supports PDF, PNG, JPG files up to 10MB
                                        </p>
                                    </div>

                                    <span style={{
                                        backgroundColor: '#4f46e5',
                                        color: '#ffffff',
                                        padding: '0.6rem 1.25rem',
                                        borderRadius: '8px',
                                        fontSize: '0.9rem',
                                        fontWeight: 600
                                    }}>
                                        {file ? 'Change File' : 'Browse Receipt File'}
                                    </span>
                                </div>
                            </label>
                            <input 
                                id="receipt-file-input"
                                type="file" 
                                accept="image/*,application/pdf"
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                            />

                            <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
                                <button
                                    onClick={handleScanReceipt}
                                    disabled={!file || isScanning}
                                    style={{
                                        backgroundColor: !file || isScanning ? '#cbd5e1' : '#4f46e5',
                                        color: '#ffffff',
                                        border: 'none',
                                        padding: '0.85rem 2rem',
                                        borderRadius: '10px',
                                        fontSize: '1rem',
                                        fontWeight: 600,
                                        cursor: !file || isScanning ? 'not-allowed' : 'pointer',
                                        boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.3)'
                                    }}
                                >
                                    {isScanning ? '⚡ Processing OpenCV & OCR...' : '🔍 Scan & Extract Line Items'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* --- STEP 2: REVIEW PARSED ITEMS & BATCH SAVE --- */
                        <div>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '1rem'
                            }}>
                                <div>
                                    <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
                                        Extracted {scanResult.length} Line Items
                                    </h4>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                                        Review auto-assigned categories and prices before saving to Artha
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Calculated Total: </span>
                                    <strong style={{ fontSize: '1.25rem', color: '#16a34a' }}>
                                        {formatCurrency(totalBillSum)}
                                    </strong>
                                </div>
                            </div>

                            {/* Batch Config Controls */}
                            <div style={{
                                backgroundColor: '#f8fafc',
                                padding: '1rem',
                                borderRadius: '12px',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: '1rem',
                                marginBottom: '1.25rem',
                                border: '1px solid #e2e8f0'
                            }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
                                        Merchant / Store Prefix
                                    </label>
                                    <input 
                                        type="text" 
                                        value={storeName} 
                                        onChange={(e) => setStoreName(e.target.value)}
                                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
                                        Payment Mode
                                    </label>
                                    <select 
                                        value={paymentMode} 
                                        onChange={(e) => setPaymentMode(e.target.value)}
                                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                    >
                                        <option value="upi">UPI</option>
                                        <option value="debit_card">Debit Card</option>
                                        <option value="credit_card">Credit Card</option>
                                        <option value="cash">Cash</option>
                                    </select>
                                </div>

                                {paymentMode !== 'credit_card' ? (
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
                                            Deduct From Bank Account
                                        </label>
                                        <select 
                                            value={bankAccountId} 
                                            onChange={(e) => setBankAccountId(e.target.value)}
                                            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                        >
                                            <option value="">-- Cash / None --</option>
                                            {accounts.map(acc => (
                                                <option key={acc._id} value={acc._id}>{acc.bankName} ({acc.accountType})</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
                                            Select Credit Card
                                        </label>
                                        <select 
                                            value={cardId} 
                                            onChange={(e) => setCardId(e.target.value)}
                                            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
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
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
                                        Expense Type
                                    </label>
                                    <select 
                                        value={expenseType} 
                                        onChange={(e) => setExpenseType(e.target.value)}
                                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                    >
                                        <option value="variable">Variable Expense</option>
                                        <option value="fixed">Fixed Expense</option>
                                    </select>
                                </div>
                            </div>

                            {/* Extracted Items Table */}
                            <div style={{ maxHeight: '480px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                    <thead style={{ backgroundColor: '#f1f5f9', position: 'sticky', top: 0, zIndex: 10 }}>
                                        <tr>
                                            <th style={{ padding: '0.75rem', textAlign: 'left' }}>#</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Item / Fee Description</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Amount (₹)</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Category Match</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'center' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {scanResult.map((item, idx) => {
                                            const isFee = /fee|tax|charge|gst/i.test(item.description);
                                            return (
                                                <tr key={idx} style={{ 
                                                    borderBottom: '1px solid #f1f5f9',
                                                    backgroundColor: isFee ? '#fffbe6' : 'transparent'
                                                }}>
                                                    <td style={{ padding: '0.75rem', color: '#64748b' }}>{idx + 1}</td>
                                                    <td style={{ padding: '0.75rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <input 
                                                                type="text" 
                                                                value={item.description} 
                                                                onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                                                style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                                            />
                                                            {isFee && (
                                                                <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: '#fef08a', color: '#854d0e', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                                    Fee / Tax
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '0.75rem', width: '110px' }}>
                                                        <input 
                                                            type="number" 
                                                            step="0.01"
                                                            value={item.amount} 
                                                            onChange={(e) => handleItemChange(idx, 'amount', e.target.value)}
                                                            style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: isFee ? 700 : 400 }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '0.75rem' }}>
                                                        <span style={{
                                                            display: 'inline-block',
                                                            padding: '0.25rem 0.6rem',
                                                            borderRadius: '20px',
                                                            fontSize: '0.8rem',
                                                            fontWeight: 600,
                                                            backgroundColor: item.confidence >= 0.85 ? '#dcfce7' : '#fef9c3',
                                                            color: item.confidence >= 0.85 ? '#15803d' : '#a16207'
                                                        }}>
                                                            {item.mainCategory} → {item.subCategory} ({Math.round(item.confidence * 100)}%)
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                                        <button 
                                                            onClick={() => handleRemoveItem(idx)}
                                                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }}
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
                            <div style={{ marginTop: '0.5rem', textAlign: 'right' }}>
                                <button
                                    onClick={handleAddItem}
                                    style={{
                                        backgroundColor: '#e0e7ff',
                                        color: '#3730a3',
                                        border: 'none',
                                        padding: '0.4rem 0.85rem',
                                        borderRadius: '6px',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    ➕ Add Item Manually
                                </button>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <button
                                    onClick={() => setScanResult(null)}
                                    style={{
                                        backgroundColor: '#f1f5f9',
                                        color: '#475569',
                                        border: 'none',
                                        padding: '0.75rem 1.25rem',
                                        borderRadius: '8px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    🔄 Rescan New Receipt
                                </button>

                                <button
                                    onClick={handleBatchSave}
                                    disabled={isSaving || scanResult.length === 0}
                                    style={{
                                        backgroundColor: '#16a34a',
                                        color: '#ffffff',
                                        border: 'none',
                                        padding: '0.75rem 1.75rem',
                                        borderRadius: '8px',
                                        fontWeight: 700,
                                        fontSize: '1rem',
                                        cursor: isSaving ? 'not-allowed' : 'pointer',
                                        boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.3)'
                                    }}
                                >
                                    {isSaving ? 'Saving Items...' : `✨ Save ${scanResult.length} Items to Artha`}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
