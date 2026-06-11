const mongoose = require('mongoose');

const bankAccountSchema = new mongoose.Schema({
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bankName:    { type: String, required: true, trim: true },
    accountName: { type: String, required: true, trim: true },
    lastFourDigits: { type: String, maxlength: 4 },
    accountType: { type: String, enum: ['savings', 'current'], default: 'savings' },
    balance:     { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('BankAccount', bankAccountSchema);