const mongoose = require('mongoose');

// ─── Installment subdocument ──────────────────────────────────────────────────
const installmentSchema = new mongoose.Schema({
    installmentNumber: {
        type: Number,
        required: true
    },
    dueDate: {
        type: Date,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'paid'],
        default: 'pending'
    },
    paidAt: {
        type: Date,
        default: null
    }
}, { _id: true });

// ─── EMI schema ────────────────────────────────────────────────────────────────
const emiSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
        // e.g. "Bike Loan - HDFC", "iPhone 15 - ICICI Amazon Pay"
    },
    loanType: {
        type: String,
        enum: ['loan', 'credit_card'],
        required: true
    },

    // ── Only set when loanType = credit_card ───────────────────────────────────
    cardId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Card',
        default: null
    },

    // ── Loan terms ──────────────────────────────────────────────────────────────
    principalAmount: {
        type: Number,
        required: true
    },
    monthlyAmount: {
        type: Number,
        required: true
    },
    tenureMonths: {
        type: Number,
        required: true
    },
    interestRate: {
        type: Number,
        default: 0
        // annual %, optional, purely informational
    },
    startDate: {
        type: Date,
        required: true
    },

    // ── Lender info ─────────────────────────────────────────────────────────────
    lenderName: {
        type: String,
        trim: true,
        default: null
        // e.g. "HDFC Bank", "Bajaj Finserv"
    },

    // ── Progress tracking ───────────────────────────────────────────────────────
    installments: [installmentSchema],

    status: {
        type: String,
        enum: ['active', 'closed'],
        default: 'active'
        // auto-set to 'closed' when all installments are paid
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('EMI', emiSchema);