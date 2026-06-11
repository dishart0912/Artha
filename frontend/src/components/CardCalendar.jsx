import { useState } from 'react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function CardCalendar({ cards }) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear]   = useState(today.getFullYear());

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const eventMap = {};
  cards.forEach(card => {
    if (card.billingDate) {
      const d = card.billingDate;
      if (!eventMap[d]) eventMap[d] = [];
      eventMap[d].push({ cardName: card.cardName, bankName: card.bankName, type: 'billing' });
    }
    if (card.dueDate) {
      const d = card.dueDate;
      if (!eventMap[d]) eventMap[d] = [];
      eventMap[d].push({ cardName: card.cardName, bankName: card.bankName, type: 'due' });
    }
  });

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startDay    = new Date(viewYear, viewMonth, 1).getDay();

  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday = (day) =>
    day === today.getDate() &&
    viewMonth === today.getMonth() &&
    viewYear === today.getFullYear();

  return (
    <div className="bg-white rounded-2xl border border-skylight/30 p-5 shadow-sm">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-ocean">
          {MONTHS[viewMonth]} {viewYear}
        </h3>
        <div className="flex gap-1">
          <button onClick={prevMonth}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-bluebird hover:bg-skylight/20 transition text-sm">
            ‹
          </button>
          <button onClick={nextMonth}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-bluebird hover:bg-skylight/20 transition text-sm">
            ›
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blueberry inline-block" />
          <span className="text-xs text-bluebird">Billing date</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
          <span className="text-xs text-bluebird">Due date</span>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs text-bluebird/60 font-medium py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, idx) => {
          const events   = day ? (eventMap[day] || []) : [];
          const billing  = events.filter(e => e.type === 'billing');
          const due      = events.filter(e => e.type === 'due');
          const hasEvent = events.length > 0;

          return (
            <div key={idx}
              className={`relative flex flex-col items-center py-1.5 rounded-lg transition
                ${day ? 'hover:bg-skylight/10 cursor-default' : ''}
                ${isToday(day) ? 'bg-blueberry/10' : ''}
              `}
            >
              {day && (
                <span className={`text-xs font-medium mb-1 ${
                  isToday(day)  ? 'text-blueberry font-bold'
                  : hasEvent    ? 'text-ocean'
                  : 'text-bluebird/50'
                }`}>
                  {day}
                </span>
              )}
              {day && (
                <div className="flex gap-0.5">
                  {billing.length > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blueberry"
                      title={`Billing: ${billing.map(e => e.cardName).join(', ')}`} />
                  )}
                  {due.length > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400"
                      title={`Due: ${due.map(e => e.cardName).join(', ')}`} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Card summary list */}
      {Object.keys(eventMap).length > 0 && (
        <div className="mt-4 pt-4 border-t border-skylight/20 space-y-2">
          <p className="text-xs font-semibold text-bluebird/60 uppercase tracking-wide mb-2">
            This month
          </p>
          {cards.map(card => (
            <div key={card._id} className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-ocean">{card.cardName}</p>
                <p className="text-xs text-bluebird">{card.bankName}</p>
              </div>
              <div className="flex gap-3 text-xs">
                <span className="flex items-center gap-1 text-blueberry">
                  <span className="w-1.5 h-1.5 rounded-full bg-blueberry inline-block" />
                  Bill: {card.billingDate}th
                </span>
                <span className="flex items-center gap-1 text-red-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                  Due: {card.dueDate}th
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {cards.length === 0 && (
        <p className="text-center text-xs text-bluebird/50 mt-2">
          Add cards to see billing and due dates
        </p>
      )}
    </div>
  );
}