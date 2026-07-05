import { useState, useEffect } from 'react';
import { getBankAccounts } from '../services/bankAccountService';
import { formatCurrency } from '../utils/format';

export default function PayBillModal({ card, onClose, onConfirm, loading }) {
  const [paymentMode, setPaymentMode] = useState('upi');
  const [accountId, setAccountId] = useState('');
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getBankAccounts()
      .then(data => {
        if (active) {
          setBankAccounts(data);
          if (data.length > 0) {
            setAccountId(data[0]._id);
          }
          setLoadingAccounts(false);
        }
      })
      .catch(err => {
        if (active) {
          setError('Failed to load bank accounts');
          setLoadingAccounts(false);
        }
      });
    return () => { active = false; };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const needsAccount = ['upi', 'debit_card', 'bank_transfer'].includes(paymentMode);
    onConfirm(paymentMode, needsAccount ? accountId : null);
  };

  const inputClass = `
    w-full px-3.5 py-2.5 rounded-xl border border-skylight/40 bg-skylight/10
    text-ocean text-sm placeholder:text-bluebird/40
    focus:outline-none focus:ring-2 focus:ring-blueberry/30 focus:border-blueberry/40
    transition duration-150
  `;
  const labelClass = "block text-[11px] font-semibold text-ocean/50 uppercase tracking-wider mb-1.5";

  const needsAccount = ['upi', 'debit_card', 'bank_transfer'].includes(paymentMode);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ocean/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto border border-skylight/20 animate-scaleIn">
        <div className="flex items-center justify-between mb-5 border-b border-skylight/20 pb-3">
          <div>
            <h3 className="text-base font-semibold text-ocean">Confirm Card Payment</h3>
            <p className="text-xs text-bluebird mt-0.5">{card.cardName} · {card.bankName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-bluebird hover:bg-skylight/20 transition"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-clouds/50 rounded-2xl p-4 border border-skylight/20 text-center">
            <span className="text-xs font-medium text-bluebird">Billed Amount Due</span>
            <h2 className="text-2xl font-bold text-red-500 mt-1">{formatCurrency(card.billedAmount)}</h2>
          </div>

          <div>
            <label className={labelClass}>Payment Mode</label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className={inputClass}
            >
              <option value="upi">UPI</option>
              <option value="bank_transfer">Net Banking / Bank Transfer</option>
              <option value="debit_card">Debit Card</option>
              <option value="cash">Cash</option>
            </select>
          </div>

          {needsAccount && (
            <div>
              <label className={labelClass}>Pay From Bank Account</label>
              {loadingAccounts ? (
                <div className="text-xs text-bluebird">Loading accounts...</div>
              ) : bankAccounts.length === 0 ? (
                <div className="text-xs text-red-500 font-semibold">
                  No bank accounts found! Please add a bank account first.
                </div>
              ) : (
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className={inputClass}
                  required
                >
                  {bankAccounts.map((acc) => (
                    <option key={acc._id} value={acc._id}>
                      {acc.bankName} - {acc.accountName} (Balance: {formatCurrency(acc.balance)})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-3 border-t border-skylight/20">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-skylight text-ocean hover:bg-skylight/10 font-semibold text-sm transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (needsAccount && bankAccounts.length === 0)}
              className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm transition shadow disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Confirm Paid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
