const Transaction = require('../models/Transaction');
const Card = require('../models/Card');
const Receivable = require('../models/Receivable');

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

        const transactions = await Transaction.find({
            userId,
            date: { $gte: monthStart, $lte: monthEnd }
        });

        const inflowTransactions = transactions.filter(
            t => t.transactionType === 'inflow' && t.paymentMode !== 'credit_card'
        );

        const txnInflow = inflowTransactions.reduce((sum, t) => sum + t.amount, 0);

        const directExpenses = transactions
            .filter(t => t.transactionType === 'expense' && t.paymentMode !== 'credit_card')
            .reduce((sum, t) => sum + t.amount, 0);

        const fixedExpenses = transactions
            .filter(t => t.transactionType === 'expense' && t.expenseType === 'fixed')
            .reduce((sum, t) => sum + t.amount, 0);

        const variableExpenses = transactions
            .filter(t => t.transactionType === 'expense' && t.expenseType === 'variable')
            .reduce((sum, t) => sum + t.amount, 0);

        // Received receivables this month
        const receivedReceivables = await Receivable.find({
            userId,
            status: 'received',
            receivedAt: { $gte: monthStart, $lte: monthEnd }
        });

        const receivablesInflow = receivedReceivables.reduce((sum, r) => sum + r.amount, 0);
        const totalInflow = txnInflow + receivablesInflow;

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
                    cardName:    card.cardName,
                    bankName:    card.bankName,
                    creditLimit: card.creditLimit,
                    outstanding,
                    utilization: `${utilization}%`,
                    dueDate:     card.dueDate,
                    billingDate: card.billingDate
                };
            })
        );

        res.status(200).json({
            month: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`,
            totalInflow,
            txnInflow,
            receivablesInflow,
            fixedExpenses,
            variableExpenses,
            directExpenses,
            cardOutstanding,
            // Raw items for the popup
            inflowItems: [
                ...inflowTransactions.map(t => ({
                    _id:    t._id,
                    name:   t.name,
                    amount: t.amount,
                    date:   t.date,
                    source: 'transaction',
                    mode:   t.paymentMode,
                    category: t.category,
                })),
                ...receivedReceivables.map(r => ({
                    _id:    r._id,
                    name:   r.clientName,
                    amount: r.amount,
                    date:   r.receivedAt,
                    source: 'receivable',
                    description: r.description,
                })),
            ].sort((a, b) => new Date(b.date) - new Date(a.date)),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getDashboard };