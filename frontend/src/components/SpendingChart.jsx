import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-skylight/30 rounded-xl px-4 py-3 shadow-md text-xs">
      <p className="font-semibold text-ocean mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          <span className="text-bluebird capitalize">{p.name}:</span>
          <span className="font-semibold text-ocean">
            ₹{Number(p.value).toLocaleString('en-IN')}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function SpendingChart({ transactions }) {
  const chartData = useMemo(() => {
    const now = new Date();
    // Build last 6 months
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: `${MONTHS[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`,
        inflow: 0,
        expense: 0,
      });
    }

    // Bucket each transaction into its month
    transactions.forEach(txn => {
      const d = new Date(txn.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const bucket = months.find(m => m.key === key);
      if (!bucket) return;
      if (txn.transactionType === 'inflow')  bucket.inflow  += txn.amount;
      if (txn.transactionType === 'expense') bucket.expense += txn.amount;
    });

    return months.map(({ label, inflow, expense }) => ({ label, inflow, expense }));
  }, [transactions]);

  const hasData = chartData.some(d => d.inflow > 0 || d.expense > 0);

  if (!hasData) return (
    <div className="bg-white rounded-2xl border border-skylight/30 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-ocean mb-1">Spending Trends</h3>
      <p className="text-xs text-bluebird/60 mb-6">Last 6 months</p>
      <div className="flex items-center justify-center h-40 text-bluebird/40 text-sm">
        Add transactions to see trends
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-skylight/30 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-ocean mb-1">Spending Trends</h3>
      <p className="text-xs text-bluebird/60 mb-6">Last 6 months — inflow vs expenses</p>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#0055A0" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#0055A0" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#f87171" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#8CC1E920" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#438BC4', fontFamily: 'Inter' }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#438BC4', fontFamily: 'Inter' }}
            axisLine={false} tickLine={false}
            tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle" iconSize={8}
            formatter={v => <span style={{ fontSize: 11, color: '#438BC4', textTransform: 'capitalize' }}>{v}</span>}
          />
          <Area
            type="monotone" dataKey="inflow" name="inflow"
            stroke="#0055A0" strokeWidth={2}
            fill="url(#inflowGrad)" dot={{ r: 3, fill: '#0055A0', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#0055A0' }}
          />
          <Area
            type="monotone" dataKey="expense" name="expense"
            stroke="#f87171" strokeWidth={2}
            fill="url(#expenseGrad)" dot={{ r: 3, fill: '#f87171', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#f87171' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}