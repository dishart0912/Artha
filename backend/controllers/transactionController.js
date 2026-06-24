const Transaction = require('../models/Transaction');
const BankAccount = require('../models/BankAccount');
const Card = require('../models/Card');

// ─── Payment modes that require a bank account ────────────────────────────────
const BANK_LINKED_MODES = ['upi', 'debit_card', 'bank_transfer'];

// ─── Helper: apply a balance delta to a bank account ─────────────────────────
// delta > 0  → add to balance   (inflow, or reversing an expense)
// delta < 0  → deduct balance   (expense, or reversing an inflow)
const applyBalanceDelta = async (accountId, delta) => {
    if (!accountId || delta === 0) return;
    await BankAccount.findByIdAndUpdate(
        accountId,
        { $inc: { balance: delta } }
    );
};

// ─── Helper: compute the delta a transaction should apply to its account ──────
// Returns the amount to ADD to balance.
// Inflow  → +amount  (money coming in)
// Expense → -amount  (money going out)
const getDelta = (transactionType, amount) =>
    transactionType === 'inflow' ? +amount : -amount;

// ─── Helper: compute billing status for credit card transactions ──────────────
const computeBillingStatus = async (cardId, date) => {
    if (!cardId) return null;
    const card = await Card.findById(cardId);
    if (!card) return null;
    const transactionDay = new Date(date).getDate();
    return transactionDay <= card.billingDate ? 'unbilled' : 'billed';
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/transactions
// ─────────────────────────────────────────────────────────────────────────────
const addTransaction = async (req, res) => {
    try {
        const {
            name, amount, date, paymentMode,
            transactionType, cardId, accountId,
            expenseType, category
        } = req.body;

        // ── Validation ───────────────────────────────────────────────────────
        const needsAccount = BANK_LINKED_MODES.includes(paymentMode);
        if (needsAccount && !accountId) {
            return res.status(400).json({
                message: `A bank account is required for ${paymentMode} transactions.`
            });
        }

        // ── Credit card billing status ────────────────────────────────────────
        const billingStatus =
            paymentMode === 'credit_card'
                ? await computeBillingStatus(cardId, date)
                : null;

        // ── Create transaction ────────────────────────────────────────────────
        const transaction = await Transaction.create({
            userId: req.user._id,
            name,
            amount,
            date,
            paymentMode,
            transactionType,
            accountId: needsAccount ? accountId : null,
            cardId: cardId || null,
            billingStatus,
            expenseType: expenseType || null,
            category: category || null
        });

        // ── Update bank account balance ───────────────────────────────────────
        // Cash and credit_card never touch bank balances.
        if (needsAccount && accountId) {
            await applyBalanceDelta(accountId, getDelta(transactionType, amount));
        }

        res.status(201).json(transaction);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/transactions
// ─────────────────────────────────────────────────────────────────────────────
const getTransactions = async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user._id })
            .populate('cardId', 'cardName bankName')
            .populate('accountId', 'bankName accountName accountType lastFourDigits')
            .sort({ date: -1 });

        res.status(200).json(transactions);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/transactions/:id
// ─────────────────────────────────────────────────────────────────────────────
const updateTransaction = async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);

        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }
        if (transaction.userId.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const {
            name, amount, date, paymentMode,
            transactionType, cardId, accountId,
            expenseType, category
        } = req.body;

        // ── Validation ───────────────────────────────────────────────────────
        const needsAccount = BANK_LINKED_MODES.includes(paymentMode);
        if (needsAccount && !accountId) {
            return res.status(400).json({
                message: `A bank account is required for ${paymentMode} transactions.`
            });
        }

        // ── Step 1: Reverse the OLD transaction's balance impact ──────────────
        const oldNeedsAccount = BANK_LINKED_MODES.includes(transaction.paymentMode);
        if (oldNeedsAccount && transaction.accountId) {
            // Reverse = opposite delta
            await applyBalanceDelta(
                transaction.accountId,
                -getDelta(transaction.transactionType, transaction.amount)
            );
        }

        // ── Step 2: Build updated fields ──────────────────────────────────────
        const billingStatus =
            paymentMode === 'credit_card'
                ? await computeBillingStatus(cardId, date)
                : null;

        const updatedFields = {
            name,
            amount,
            date,
            paymentMode,
            transactionType,
            accountId: needsAccount ? accountId : null,
            cardId: cardId || null,
            billingStatus,
            expenseType: expenseType || null,
            category: category || null
        };

        const updatedTransaction = await Transaction.findByIdAndUpdate(
            req.params.id,
            updatedFields,
            { new: true }
        ).populate('cardId', 'cardName bankName')
         .populate('accountId', 'bankName accountName accountType lastFourDigits');

        // ── Step 3: Apply the NEW transaction's balance impact ────────────────
        if (needsAccount && accountId) {
            await applyBalanceDelta(accountId, getDelta(transactionType, amount));
        }

        res.status(200).json(updatedTransaction);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/transactions/:id
// ─────────────────────────────────────────────────────────────────────────────
const deleteTransaction = async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);

        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }
        if (transaction.userId.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        // ── Reverse the balance impact before deleting ────────────────────────
        const needsAccount = BANK_LINKED_MODES.includes(transaction.paymentMode);
        if (needsAccount && transaction.accountId) {
            await applyBalanceDelta(
                transaction.accountId,
                -getDelta(transaction.transactionType, transaction.amount)
            );
        }

        await Transaction.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Transaction removed' });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/transactions/pay-bill
// ─────────────────────────────────────────────────────────────────────────────
const payCardBill = async (req, res) => {
    try {
        const { cardId } = req.body;
        if (!cardId) {
            return res.status(400).json({ message: 'Card ID is required' });
        }

        const card = await Card.findById(cardId);
        if (!card) {
            return res.status(404).json({ message: 'Card not found' });
        }

        // Fetch all transactions (expenses and inflows) for this card
        const cardTransactions = await Transaction.find({
            userId: req.user._id,
            cardId,
            paymentMode: 'credit_card'
        });

        const expenses = cardTransactions.filter(t => t.transactionType === 'expense');
        const payments = cardTransactions.filter(t => t.transactionType === 'inflow');
        const totalPayments = payments.reduce((sum, t) => sum + t.amount, 0);

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

        const billedExpenses = expenses.filter(t => {
            const stmtDate = getStatementDateForTxn(t.date, card.billingDate);
            return stmtDate <= latestStatementDate;
        });

        const totalBilledExpenses = billedExpenses.reduce((sum, t) => sum + t.amount, 0);
        const billedAmount = Math.max(0, totalBilledExpenses - totalPayments);

        if (billedAmount <= 0) {
            return res.status(400).json({ message: 'Billed amount is already paid / zero.' });
        }

        // Create an inflow payment transaction of amount = billedAmount
        const paymentTxn = await Transaction.create({
            userId: req.user._id,
            name: `Card Payment - ${card.cardName}`,
            amount: billedAmount,
            date: new Date(),
            paymentMode: 'credit_card',
            transactionType: 'inflow',
            cardId: card._id,
            billingStatus: null
        });

        res.status(200).json({
            message: 'Credit card bill paid successfully',
            payment: paymentTxn
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { addTransaction, getTransactions, updateTransaction, deleteTransaction, payCardBill };