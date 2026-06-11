const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    cardName: {
        type: String,
        required: true,
        trim: true
    },
    bankName: {
        type: String,
        required: true,
        trim: true
    },
    cardType: {
        type: String,
        enum: ['credit', 'debit'],
        default: 'credit'
    },
    creditLimit: {
        type: Number,
        required: true
    },
    billingDate: {
        type: Number,
        required: true
    },
    dueDate: {
        type: Number,
        required: true
    },
    expiryDate: {
        type: Date,
        required: true
    },
    rewards: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Card', cardSchema);