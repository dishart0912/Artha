const Transaction = require('../models/Transaction');
const Card = require('../models/Card');

const getDashboard = async (req, res) => {
    try {
        const userId = req.user._id;

        const now        = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const transactions = await Transaction.find({
            userId,
            date: { $gte: monthStart, $lte: monthEnd }
        });

        // ── Total Inflow ──────────────────────────────────────────────────────
        // Only real-money inflows (not credit card, which is borrowed money)
        const totalInflow = transactions
            .filter(t =>
                t.transactionType === 'inflow' &&
                t.paymentMode !== 'credit_card'
            )
            .reduce((sum, t) => sum + t.amount, 0);

        // ── Direct Expenses ───────────────────────────────────────────────────
        // Any expense that pulls from real money:
        // cash, upi, bank_transfer, debit_card — everything except credit_card
        const directExpenses = transactions
            .filter(t =>
                t.transactionType === 'expense' &&
                t.paymentMode !== 'credit_card'
            )
            .reduce((sum, t) => sum + t.amount, 0);

        

        // ── Fixed / Variable ──────────────────────────────────────────────────
        const fixedExpenses = transactions
            .filter(t =>
                t.transactionType === 'expense' &&
                t.expenseType === 'fixed'
            )
            .reduce((sum, t) => sum + t.amount, 0);

        const variableExpenses = transactions
            .filter(t =>
                t.transactionType === 'expense' &&
                t.expenseType === 'variable'
            )
            .reduce((sum, t) => sum + t.amount, 0);

        // ── Credit Card Outstanding ───────────────────────────────────────────
        const cards = await Card.find({ userId });

        const cardOutstanding = await Promise.all(cards.map(async (card) => {
            const cardTransactions = await Transaction.find({
                userId,
                cardId: card._id,
                paymentMode: 'credit_card',
                transactionType: 'expense'   // ← only count expenses, not refunds
            });

            const outstanding  = cardTransactions.reduce((sum, t) => sum + t.amount, 0);
            const utilization  = card.creditLimit > 0
                ? ((outstanding / card.creditLimit) * 100).toFixed(2)
                : '0.00';

            return {
                cardName:    card.cardName,
                bankName:    card.bankName,
                creditLimit: card.creditLimit,
                outstanding,
                utilization: `${utilization}%`,
                dueDate:     card.dueDate,
                billingDate: card.billingDate
            };
        }));

        res.status(200).json({
            totalInflow,
            fixedExpenses,
            variableExpenses,
            directExpenses,
            cardOutstanding
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getDashboard };