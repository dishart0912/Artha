const mongoose = require('mongoose');

const recurringExpenseSchema = new mongoose.Schema({
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name:     { type: String, required: true, trim: true },
    amount:   { type: Number, required: true },
    category: { type: String, trim: true },
    dueDay:   { type: Number, required: true },
    paidMonths: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('RecurringExpense', recurringExpenseSchema);