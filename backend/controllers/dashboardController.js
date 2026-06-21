const Transaction = require('../models/Transaction');
const Card = require('../models/Card');

const getDashboard = async (req, res) => {
    try {
        const userId = req.user._id;

        const { month } = req.query;
        let targetYear, targetMonth;

        if (month && /^\d{4}-\d{2}$/.test(month)) {
            const [y, m] = month.split('-').map(Number);
            targetYear  = y;
            targetMonth = m - 1;
        } else {
            const now = new Date();
            targetYear  = now.getFullYear();
            targetMonth = now.getMonth();
        }

        const monthStart = new Date(targetYear, targetMonth, 1);
        const monthEnd   = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

        // ── Monthly Transactions (now includes received receivables too) ─────
        const transactions = await Transaction.find({
            userId,
            date: { $gte: monthStart, $lte: monthEnd }
        });

        // ── Total Inflow — all inflow transactions, regardless of source ─────
        const totalInflow = transactions
            .filter(t => t.transactionType === 'inflow' && t.paymentMode !== 'credit_card')
            .reduce((sum, t) => sum + t.amount, 0);

        // ── Direct Expenses ──────────────────────────────────────────────────
        const directExpenses = transactions
            .filter(t => t.transactionType === 'expense' && t.paymentMode !== 'credit_card')
            .reduce((sum, t) => sum + t.amount, 0);

        // ── Fixed Expenses ───────────────────────────────────────────────────
        const fixedExpenses = transactions
            .filter(t => t.transactionType === 'expense' && t.expenseType === 'fixed')
            .reduce((sum, t) => sum + t.amount, 0);

        // ── Variable Expenses ────────────────────────────────────────────────
        const variableExpenses = transactions
            .filter(t => t.transactionType === 'expense' && t.expenseType === 'variable')
            .reduce((sum, t) => sum + t.amount, 0);

        // ── Credit Card Outstanding ──────────────────────────────────────────
        const cards = await Card.find({ userId });

        const cardOutstanding = await Promise.all(
            cards.map(async (card) => {
                const cardTransactions = await Transaction.find({
                    userId,
                    cardId: card._id,
                    paymentMode: 'credit_card',
                    transactionType: 'expense',
                    date: { $gte: monthStart, $lte: monthEnd }
                });

                const outstanding = cardTransactions.reduce((sum, t) => sum + t.amount, 0);

                const utilization = card.creditLimit > 0
                    ? ((outstanding / card.creditLimit) * 100).toFixed(2)
                    : '0.00';

                return {
                    cardName: card.cardName,
                    bankName: card.bankName,
                    creditLimit: card.creditLimit,
                    outstanding,
                    utilization: `${utilization}%`,
                    dueDate: card.dueDate,
                    billingDate: card.billingDate
                };
            })
        );

        res.status(200).json({
            month: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`,
            totalInflow,
            fixedExpenses,
            variableExpenses,
            directExpenses,
            cardOutstanding
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getDashboard };