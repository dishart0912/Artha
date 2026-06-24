const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    // base fields
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    amount: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    paymentMode: {
        type: String,
        enum: ['cash', 'upi', 'credit_card', 'debit_card', 'bank_transfer'],
        required: true
    },

    // classification fields
    transactionType: {
        type: String,
        enum: ['inflow', 'expense'],
        required: true
    },

    // ── Bank Account link ──────────────────────────────────────────────────
    // Required for: upi, debit_card, bank_transfer
    // Null for:     cash, credit_card
    accountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BankAccount',
        default: null
    },

    // conditional - only when paymentMode = credit_card
    cardId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Card',
        default: null
    },
    billingStatus: {
        type: String,
        enum: ['billed', 'unbilled', 'paid'],
        default: null
    },

    // conditional - only when transactionType = expense
    expenseType: {
        type: String,
        enum: ['fixed', 'variable'],
        default: null
    },
    category: {
        type: String,
        trim: true,
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Transaction', transactionSchema);