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
        // All received receivables (for popup history)
const receivedReceivables = await Receivable.find({
    userId,
    status: 'received',
});

// Only count this month's receivables in the inflow total
const receivablesInflow = receivedReceivables
    .filter(r => new Date(r.receivedAt) >= monthStart && new Date(r.receivedAt) <= monthEnd)
    .reduce((sum, r) => sum + r.amount, 0);

const totalInflow = txnInflow + receivablesInflow;

        const cards = await Card.find({ userId });

        const cardOutstanding = await Promise.all(
            cards.map(async (card) => {
                const cardTransactions = await Transaction.find({
                    userId,
                    cardId: card._id,
                    paymentMode: 'credit_card'
                });

                const expenses = cardTransactions.filter(t => t.transactionType === 'expense');
                const payments = cardTransactions.filter(t => t.transactionType === 'inflow');
                const totalPayments = payments.reduce((sum, t) => sum + t.amount, 0);

                // Helper to find the statement date for a transaction
                const getStatementDateForTxn = (txnDate, billingDate) => {
                    const d = new Date(txnDate);
                    let year = d.getFullYear();
                    let month = d.getMonth();
                    if (d.getDate() > billingDate) {
                        month += 1;
                        if (month > 11) {
                            month = 0;
                            year += 1;
                        }
                    }
                    return new Date(year, month, billingDate, 23, 59, 59, 999);
                };

                const today = new Date();

                // Most recent statement date
                let stmtYear = today.getFullYear();
                let stmtMonth = today.getMonth();
                if (today.getDate() < card.billingDate) {
                    stmtMonth -= 1;
                    if (stmtMonth < 0) {
                        stmtMonth = 11;
                        stmtYear -= 1;
                    }
                }
                const latestStatementDate = new Date(stmtYear, stmtMonth, card.billingDate, 23, 59, 59, 999);

                // Due date for the latest statement
                let dueYear = latestStatementDate.getFullYear();
                let dueMonth = latestStatementDate.getMonth() + 1;
                if (dueMonth > 11) {
                    dueMonth = 0;
                    dueYear += 1;
                }
                const latestDueDate = new Date(dueYear, dueMonth, card.dueDate, 23, 59, 59, 999);

                // Classify expenses
                const billedExpenses = expenses.filter(t => {
                    const stmtDate = getStatementDateForTxn(t.date, card.billingDate);
                    return stmtDate <= latestStatementDate;
                });

                const unbilledExpenses = expenses.filter(t => {
                    const stmtDate = getStatementDateForTxn(t.date, card.billingDate);
                    return stmtDate > latestStatementDate;
                });

                const totalBilledExpenses = billedExpenses.reduce((sum, t) => sum + t.amount, 0);
                const totalUnbilledExpenses = unbilledExpenses.reduce((sum, t) => sum + t.amount, 0);

                // Payments reduce billed first, then unbilled
                const billedAmount = Math.max(0, totalBilledExpenses - totalPayments);
                const remainingPayments = Math.max(0, totalPayments - totalBilledExpenses);
                const unbilledAmount = Math.max(0, totalUnbilledExpenses - remainingPayments);
                
                const outstanding = billedAmount + unbilledAmount;
                const utilization = card.creditLimit > 0
                    ? ((outstanding / card.creditLimit) * 100).toFixed(2)
                    : '0.00';

                const availableCredit = Math.max(0, card.creditLimit - outstanding);

                const paymentsAppliedToBilled = Math.min(totalBilledExpenses, totalPayments);
                const paymentsAppliedToUnbilled = Math.max(0, totalPayments - totalBilledExpenses);

                return {
                    _id:         card._id,
                    cardName:    card.cardName,
                    bankName:    card.bankName,
                    creditLimit: card.creditLimit,
                    outstanding,
                    billedAmount,
                    unbilledAmount,
                    utilization: `${utilization}%`,
                    dueDate:     latestDueDate.toISOString(),
                    statementDate: latestStatementDate.toISOString(),
                    availableCredit,
                    totalBilledExpenses,
                    totalUnbilledExpenses,
                    paymentsAppliedToBilled,
                    paymentsAppliedToUnbilled,
                    billedTransactions: billedExpenses.map(t => ({
                        _id: t._id,
                        name: t.name,
                        amount: t.amount,
                        date: t.date
                    })),
                    unbilledTransactions: unbilledExpenses.map(t => ({
                        _id: t._id,
                        name: t.name,
                        amount: t.amount,
                        date: t.date
                    }))
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