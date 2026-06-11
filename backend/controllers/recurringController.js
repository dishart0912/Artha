const RecurringExpense = require('../models/RecurringExpense');

// Get current month key e.g. "2026-06"
const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

// Add recurring expense
const addRecurring = async (req, res) => {
    try {
        const expense = await RecurringExpense.create({
            userId: req.user._id,
            ...req.body
        });
        res.status(201).json(expense);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get all recurring expenses with current month status
const getRecurring = async (req, res) => {
    try {
        const currentMonth = getCurrentMonth();
        const expenses = await RecurringExpense.find({ userId: req.user._id });

        const result = expenses.map(expense => ({
            ...expense.toObject(),
            isPaidThisMonth: expense.paidMonths.includes(currentMonth),
            currentMonth
        }));

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Mark as paid for current month
const markPaid = async (req, res) => {
    try {
        const expense = await RecurringExpense.findById(req.params.id);
        if (!expense) return res.status(404).json({ message: 'Not found' });
        if (expense.userId.toString() !== req.user._id.toString())
            return res.status(401).json({ message: 'Not authorized' });

        const currentMonth = getCurrentMonth();

        if (!expense.paidMonths.includes(currentMonth)) {
            expense.paidMonths.push(currentMonth);
            await expense.save();
        }

        res.status(200).json({
            ...expense.toObject(),
            isPaidThisMonth: true,
            currentMonth
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Mark as unpaid for current month
const markUnpaid = async (req, res) => {
    try {
        const expense = await RecurringExpense.findById(req.params.id);
        if (!expense) return res.status(404).json({ message: 'Not found' });
        if (expense.userId.toString() !== req.user._id.toString())
            return res.status(401).json({ message: 'Not authorized' });

        const currentMonth = getCurrentMonth();
        expense.paidMonths = expense.paidMonths.filter(m => m !== currentMonth);
        await expense.save();

        res.status(200).json({
            ...expense.toObject(),
            isPaidThisMonth: false,
            currentMonth
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Delete recurring expense
const deleteRecurring = async (req, res) => {
    try {
        const expense = await RecurringExpense.findById(req.params.id);
        if (!expense) return res.status(404).json({ message: 'Not found' });
        if (expense.userId.toString() !== req.user._id.toString())
            return res.status(401).json({ message: 'Not authorized' });

        await RecurringExpense.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { addRecurring, getRecurring, markPaid, markUnpaid, deleteRecurring };