const Transaction = require('../models/Transaction');
const Card = require('../models/Card');
const Receivable = require('../models/Receivable');

const getDashboard = async (req, res) => {
    try {
        const userId = req.user._id;

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        // ── Monthly Transactions ─────────────────────────────────────────────
        const transactions = await Transaction.find({
            userId,
            date: { $gte: monthStart, $lte: monthEnd }
        });

        // ── Transaction Inflow ───────────────────────────────────────────────
        const transactionInflow = transactions
            .filter(
                (t) =>
                    t.transactionType === 'inflow' &&
                    t.paymentMode !== 'credit_card'
            )
            .reduce((sum, t) => sum + t.amount, 0);

        // ── Received Receivables This Month ──────────────────────────────────
        const receivedReceivables = await Receivable.find({
            userId,
            status: 'received',
            receivedAt: {
                $gte: monthStart,
                $lte: monthEnd
            }
        });

        const receivableAmount = receivedReceivables.reduce(
            (sum, r) => sum + r.amount,
            0
        );

        // ── Total Inflow ─────────────────────────────────────────────────────
        const totalInflow = transactionInflow + receivableAmount;

        // ── Direct Expenses ──────────────────────────────────────────────────
        const directExpenses = transactions
            .filter(
                (t) =>
                    t.transactionType === 'expense' &&
                    t.paymentMode !== 'credit_card'
            )
            .reduce((sum, t) => sum + t.amount, 0);

        // ── Fixed Expenses ───────────────────────────────────────────────────
        const fixedExpenses = transactions
            .filter(
                (t) =>
                    t.transactionType === 'expense' &&
                    t.expenseType === 'fixed'
            )
            .reduce((sum, t) => sum + t.amount, 0);

        // ── Variable Expenses ────────────────────────────────────────────────
        const variableExpenses = transactions
            .filter(
                (t) =>
                    t.transactionType === 'expense' &&
                    t.expenseType === 'variable'
            )
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
    date: { $gte: monthStart, $lte: monthEnd }  // ← add this
});

                const outstanding = cardTransactions.reduce(
                    (sum, t) => sum + t.amount,
                    0
                );

                const utilization =
                    card.creditLimit > 0
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
            totalInflow,
            fixedExpenses,
            variableExpenses,
            directExpenses,
            cardOutstanding
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: error.message
        });
    }
};

module.exports = { getDashboard };