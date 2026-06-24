import React from 'react';
import { formatCurrency } from '../utils/format';

export default function DetailsPopup({ item, onClose }) {
  if (!item) return null;

  const isReceivable = item.source === 'receivable' || item.clientName !== undefined;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ocean/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scaleIn border border-skylight/20 z-10">
        
        {/* Header/Banner Accent */}
        <div className={`h-2.5 w-full ${isReceivable ? 'bg-emerald-500' : item.transactionType === 'inflow' ? 'bg-emerald-500' : 'bg-red-400'}`} />

        <div className="px-6 pt-5 pb-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-[10px] text-bluebird/60 font-bold uppercase tracking-wider">
                {isReceivable ? 'Receivable Details' : 'Transaction Details'}
              </p>
              <h3 className="text-base font-bold text-ocean mt-0.5">{isReceivable ? item.name || item.clientName : item.name}</h3>
            </div>
            <button onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-bluebird/60 hover:bg-skylight/10 hover:text-ocean transition text-sm">
              ✕
            </button>
          </div>

          {/* Amount block */}
          <div className="bg-skylight/10 rounded-2xl p-4 text-center mb-5 border border-skylight/20">
            <p className="text-[10px] text-bluebird/60 font-semibold uppercase tracking-wider">Amount</p>
            <p className={`text-2xl font-black mt-1 tabular-nums ${isReceivable || item.transactionType === 'inflow' ? 'text-emerald-500' : 'text-red-500'}`}>
              {(isReceivable || item.transactionType === 'inflow') ? '+' : '-'}{formatCurrency(item.amount)}
            </p>
          </div>

          {/* Detail lines */}
          <div className="space-y-3.5 text-xs text-bluebird/90">
            {isReceivable ? (
              <>
                <div className="flex justify-between border-b border-skylight/10 pb-2">
                  <span className="text-bluebird/60">Status:</span>
                  <span className={`font-bold capitalize ${item.status === 'pending' ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {item.status || 'received'}
                  </span>
                </div>
                {item.dueDate && (
                  <div className="flex justify-between border-b border-skylight/10 pb-2">
                    <span className="text-bluebird/60">Due Date:</span>
                    <span className="font-semibold text-ocean">
                      {new Date(item.dueDate).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'long', year: 'numeric'
                      })}
                    </span>
                  </div>
                )}
                {item.status === 'received' && item.receivedAt && (
                  <div className="flex justify-between border-b border-skylight/10 pb-2">
                    <span className="text-bluebird/60">Received Date:</span>
                    <span className="font-semibold text-ocean">
                      {new Date(item.receivedAt).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'long', year: 'numeric'
                      })}
                    </span>
                  </div>
                )}
                {item.description && (
                  <div className="flex flex-col gap-1">
                    <span className="text-bluebird/60">Description:</span>
                    <p className="font-medium text-ocean bg-skylight/10 p-2 rounded-lg leading-relaxed">{item.description}</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex justify-between border-b border-skylight/10 pb-2">
                  <span className="text-bluebird/60">Date:</span>
                  <span className="font-semibold text-ocean">
                    {new Date(item.date || item.receivedAt || item.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'long', year: 'numeric'
                    })}
                  </span>
                </div>
                <div className="flex justify-between border-b border-skylight/10 pb-2">
                  <span className="text-bluebird/60">Type:</span>
                  <span className={`font-semibold capitalize ${item.transactionType === 'inflow' ? 'text-emerald-500' : 'text-red-400'}`}>
                    {item.transactionType}
                  </span>
                </div>
                {item.paymentMode && (
                  <div className="flex justify-between border-b border-skylight/10 pb-2">
                    <span className="text-bluebird/60">Payment Mode:</span>
                    <span className="font-semibold text-ocean capitalize">
                      {item.paymentMode.replace('_', ' ')}
                    </span>
                  </div>
                )}
                {item.category && (
                  <div className="flex justify-between border-b border-skylight/10 pb-2">
                    <span className="text-bluebird/60">Category:</span>
                    <span className="font-semibold text-ocean bg-skylight/20 px-2 py-0.5 rounded-full text-[10px]">
                      {item.category}
                    </span>
                  </div>
                )}
                {item.expenseType && (
                  <div className="flex justify-between border-b border-skylight/10 pb-2">
                    <span className="text-bluebird/60">Expense Type:</span>
                    <span className="font-semibold text-ocean capitalize">
                      {item.expenseType}
                    </span>
                  </div>
                )}
                {item.billingStatus && (
                  <div className="flex justify-between border-b border-skylight/10 pb-2">
                    <span className="text-bluebird/60">Billing Status:</span>
                    <span className={`font-bold capitalize ${
                      item.billingStatus === 'billed' ? 'text-red-500' : item.billingStatus === 'unbilled' ? 'text-yellow-600' : 'text-emerald-500'
                    }`}>
                      {item.billingStatus}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
