const mongoose = require('mongoose');

const receivableSchema = new mongoose.Schema({
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    clientName:    { type: String, required: true, trim: true },
    amount:        { type: Number, required: true },
    description:   { type: String, trim: true },
    dueDate:       { type: Date },
    status:        { type: String, enum: ['pending', 'received'], default: 'pending' },
    receivedAt:    { type: Date, default: null },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null }
}, { timestamps: true });

module.exports = mongoose.model('Receivable', receivableSchema);