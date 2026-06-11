import { useState, useEffect } from 'react';

const defaultForm = {
  cardName: '', bankName: '', cardType: 'credit',
  creditLimit: '', billingDate: '', dueDate: '',
  expiryDate: '', rewards: ''
};

export default function CardForm({ initial, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    if (initial) setForm({ ...defaultForm, ...initial });
    else setForm(defaultForm);
  }, [initial]);

  const handle = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  const inputClass = `
    w-full px-3.5 py-2.5 rounded-xl border border-skylight/40 bg-skylight/10
    text-ocean text-sm placeholder:text-bluebird/40
    focus:outline-none focus:ring-2 focus:ring-blueberry/30 focus:border-blueberry/40
    transition duration-150
  `;
  const labelClass = "block text-[11px] font-semibold text-ocean/50 uppercase tracking-wider mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Row 1 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Card Name</label>
          <input name="cardName" value={form.cardName} onChange={handle}
            required placeholder="e.g. HDFC Regalia"
            className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Bank Name</label>
          <input name="bankName" value={form.bankName} onChange={handle}
            required placeholder="e.g. HDFC Bank"
            className={inputClass} />
        </div>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Card Type</label>
          <select name="cardType" value={form.cardType} onChange={handle} className={inputClass}>
            <option value="credit">Credit</option>
            <option value="debit">Debit</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Credit Limit (₹)</label>
          <input name="creditLimit" value={form.creditLimit} onChange={handle}
            type="number" placeholder="e.g. 100000"
            required className={inputClass} />
        </div>
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Billing Day</label>
          <input name="billingDate" value={form.billingDate} onChange={handle}
            type="number" min="1" max="31" placeholder="e.g. 15"
            required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Due Day</label>
          <input name="dueDate" value={form.dueDate} onChange={handle}
            type="number" min="1" max="31" placeholder="e.g. 5"
            required className={inputClass} />
        </div>
      </div>

      {/* Row 4 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Expiry Date</label>
          <input name="expiryDate" value={form.expiryDate} onChange={handle}
            type="date" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Rewards / Notes</label>
          <input name="rewards" value={form.rewards} onChange={handle}
            placeholder="e.g. 2x on dining"
            className={inputClass} />
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-skylight/30 pt-4 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-skylight/40 text-sm font-medium text-ocean/70 hover:bg-skylight/10 transition duration-150"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-ocean to-blueberry text-white text-sm font-semibold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-sm flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Saving…
            </>
          ) : initial ? 'Save Changes' : 'Add Card'}
        </button>
      </div>

    </form>
  );
}