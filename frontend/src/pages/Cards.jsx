import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import CardForm from '../components/CardForm';
import { getCards, addCard, updateCard, deleteCard } from '../services/cardService';
import { formatCurrency } from '../utils/format';

// ─── Skeleton loader ────────────────────────────────────────────────────────
function Skeleton({ className }) {
  return <div className={`animate-pulse bg-skylight/30 rounded-xl ${className}`} />;
}

// ─── Credit card visual chip ─────────────────────────────────────────────────
function CardChip() {
  return (
    <svg width="28" height="22" viewBox="0 0 28 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.5" width="27" height="21" rx="3.5" fill="white" fillOpacity="0.25" stroke="white" strokeOpacity="0.4" />
      <line x1="0.5" y1="7.5" x2="27.5" y2="7.5" stroke="white" strokeOpacity="0.4" />
      <line x1="0.5" y1="14.5" x2="27.5" y2="14.5" stroke="white" strokeOpacity="0.4" />
      <line x1="9.5" y1="0.5" x2="9.5" y2="21.5" stroke="white" strokeOpacity="0.4" />
      <line x1="18.5" y1="0.5" x2="18.5" y2="21.5" stroke="white" strokeOpacity="0.4" />
    </svg>
  );
}

// ─── Utilization badge ────────────────────────────────────────────────────────
function UtilBadge({ pct }) {
  if (pct > 80) return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100/80 text-red-500">{pct}% used</span>;
  if (pct > 50) return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-100/80 text-yellow-600">{pct}% used</span>;
  return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-skylight/30 text-blueberry">{pct}% used</span>;
}

// ─── Single card tile ─────────────────────────────────────────────────────────
function CardTile({ card, index, onEdit, onDelete }) {
  const [flipped, setFlipped] = useState(false);
  const isCredit = card.cardType === 'credit';

  // Gradient palette cycles through a few ocean-family gradients
  const gradients = [
    'from-ocean to-blueberry',
    'from-blueberry to-[#1e3a5f]',
    'from-[#1a3a6b] to-ocean',
    'from-[#0f2d55] to-blueberry',
  ];
  const gradient = gradients[index % gradients.length];

  return (
    <div
      className="animate-fadeIn"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* ── Card face (flippable) ── */}
      <div
        className="group relative rounded-2xl overflow-hidden cursor-pointer mb-4"
        style={{ perspective: '1000px' }}
        onClick={() => setFlipped(f => !f)}
        title="Click to flip"
      >
        {/* Flip wrapper */}
        <div
          className="transition-transform duration-500 relative"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            minHeight: '190px',
          }}
        >
          {/* FRONT */}
          <div
            className={`bg-gradient-to-br ${gradient} rounded-2xl p-5 absolute inset-0`}
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
          >
            {/* Decorative circle */}
            <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/5" />
            <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-white/5" />

            <div className="relative z-10 flex flex-col h-full justify-between" style={{ minHeight: '170px' }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] text-skylight/70 font-semibold uppercase tracking-widest">{card.bankName}</p>
                  <p className="text-base font-bold text-white mt-0.5 leading-tight">{card.cardName}</p>
                </div>
                <CardChip />
              </div>
              <div className="flex items-end justify-between mb-2">
                <div>
                  <p className="text-[10px] text-skylight/60 uppercase tracking-wider">
                    {isCredit ? 'Credit Limit' : 'Card Type'}
                  </p>
                  <p className="text-sm font-semibold text-white mt-0.5">
                    {isCredit ? formatCurrency(card.creditLimit) : 'Debit'}
                  </p>
                </div>
                {card.expiryDate && (
                  <div className="text-right">
                    <p className="text-[10px] text-skylight/60 uppercase tracking-wider">Expires</p>
                    <p className="text-sm font-semibold text-white mt-0.5">
                      {new Date(card.expiryDate).toLocaleDateString('en-IN', { month: '2-digit', year: '2-digit' })}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* flip hint */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <span className="text-[9px] text-white/40 font-medium tracking-wider">TAP TO FLIP</span>
            </div>
          </div>

          {/* BACK */}
          <div
            className={`bg-gradient-to-br ${gradient} rounded-2xl p-5 absolute inset-0`}
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/5" />
            {/* Magnetic stripe */}
            <div className="w-full h-8 bg-black/30 rounded mb-4 mt-1" />
            <div className="space-y-1.5">
              {card.billingDate && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-skylight/60 uppercase tracking-wider">Billing Day</span>
                  <span className="text-white font-semibold">{card.billingDate}</span>
                </div>
              )}
              {card.dueDate && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-skylight/60 uppercase tracking-wider">Due Day</span>
                  <span className="text-white font-semibold">{card.dueDate}</span>
                </div>
              )}
              {card.rewards && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-skylight/60 uppercase tracking-wider">Rewards</span>
                  <span className="text-white font-semibold truncate max-w-[140px] text-right">{card.rewards}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Card detail panel ── */}
      <div className="bg-white rounded-2xl border border-skylight/30 shadow-sm p-4 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ocean">{card.cardName}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-skylight/20 text-bluebird font-medium capitalize">
              {card.cardType}
            </span>
          </div>
          {isCredit && card.creditLimit && card.outstanding != null && (
            <UtilBadge pct={Math.round((card.outstanding / card.creditLimit) * 100)} />
          )}
        </div>

        {/* Progress bar for credit utilization */}
        {isCredit && card.creditLimit && card.outstanding != null && (
          <div className="w-full bg-skylight/20 rounded-full h-1 mb-3">
            <div
              className="h-1 rounded-full bg-blueberry transition-all duration-700"
              style={{ width: `${Math.min(100, Math.round((card.outstanding / card.creditLimit) * 100))}%` }}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(card)}
            className="flex-1 py-1.5 text-xs font-medium text-ocean border border-skylight/40 rounded-lg hover:bg-skylight/10 transition-colors duration-150"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(card._id)}
            className="flex-1 py-1.5 text-xs font-medium text-red-400 border border-red-100 rounded-lg hover:bg-red-50 transition-colors duration-150"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Cards() {
  const [cards, setCards]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError]             = useState('');

  const fetchCards = async () => {
    try {
      const data = await getCards();
      setCards(data);
    } catch {
      setError('Failed to load cards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCards(); }, []);

  const openAdd    = () => { setEditingCard(null); setShowModal(true); };
  const openEdit   = (card) => { setEditingCard(card); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditingCard(null); };

  const handleSubmit = async (formData) => {
    setFormLoading(true);
    try {
      if (editingCard) await updateCard(editingCard._id, formData);
      else await addCard(formData);
      await fetchCards();
      closeModal();
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this card?')) return;
    try {
      await deleteCard(id);
      setCards(prev => prev.filter(c => c._id !== id));
    } catch {
      setError('Failed to delete card');
    }
  };

  // ── Loading skeleton ──
  if (loading) return (
    <Layout>
      <div className="mb-7">
        <Skeleton className="h-7 w-24 mb-2" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        ))}
      </div>
    </Layout>
  );

  return (
    <Layout>

      {/* ── Page header ── */}
      <div className="mb-7 animate-fadeIn">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-ocean">Cards</h2>
            <p className="text-sm text-bluebird mt-0.5">
              {cards.length} card{cards.length !== 1 ? 's' : ''} added
            </p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-ocean to-blueberry text-white text-sm font-medium rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Card
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="mb-5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-500 flex items-center gap-2 animate-fadeIn">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* ── Cards grid ── */}
      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 animate-fadeIn">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-ocean to-blueberry flex items-center justify-center mb-4 shadow-md">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-ocean mb-1">No cards yet</p>
          <p className="text-xs text-bluebird/70 mb-4">Add a card to track billing dates and limits</p>
          <button
            onClick={openAdd}
            className="px-5 py-2 bg-gradient-to-r from-ocean to-blueberry text-white text-sm font-medium rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
          >
            Add your first card →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card, i) => (
            <CardTile
              key={card._id}
              card={card}
              index={i}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <Modal
          title={editingCard ? 'Edit Card' : 'Add New Card'}
          onClose={closeModal}
        >
          <CardForm
            initial={editingCard}
            onSubmit={handleSubmit}
            onCancel={closeModal}
            loading={formLoading}
          />
        </Modal>
      )}

    </Layout>
  );
}