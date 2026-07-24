const Transaction = require('../models/Transaction');
const BankAccount = require('../models/BankAccount');
const Card = require('../models/Card');
const Receivable = require('../models/Receivable');

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

const getBankDelta = (transactionType, amount, cardId) => {
    if (cardId && transactionType === 'inflow') {
        return -amount;
    }
    return transactionType === 'inflow' ? +amount : -amount;
};

// ─── Helper: compute billing status for credit card transactions ──────────────
const computeBillingStatus = async (cardId, date) => {
    if (!cardId) return null;
    const card = await Card.findById(cardId);
    if (!card || !card.billingDate) return null;

    const today = new Date();
    const billingDate = card.billingDate;

    // Calculate statement date for this transaction
    const txnDate = new Date(date);
    let year = txnDate.getFullYear();
    let month = txnDate.getMonth();
    if (txnDate.getDate() > billingDate) {
        month += 1;
        if (month > 11) {
            month = 0;
            year += 1;
        }
    }
    const stmtDate = new Date(year, month, billingDate, 23, 59, 59, 999);

    // Calculate latest statement date
    let stmtYear = today.getFullYear();
    let stmtMonth = today.getMonth();
    if (today.getDate() < billingDate) {
        stmtMonth -= 1;
        if (stmtMonth < 0) {
            stmtMonth = 11;
            stmtYear -= 1;
        }
    }
    const latestStatementDate = new Date(stmtYear, stmtMonth, billingDate, 23, 59, 59, 999);

    return stmtDate <= latestStatementDate ? 'billed' : 'unbilled';
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/transactions
// ─────────────────────────────────────────────────────────────────────────────
const addTransaction = async (req, res) => {
    try {
        const {
            name, amount, date, paymentMode,
            transactionType, cardId, accountId,
            expenseType, category, receivableId,
            mainCategory, subCategory
        } = req.body;

        // ── Validation ───────────────────────────────────────────────────────
        const needsAccount = BANK_LINKED_MODES.includes(paymentMode);
        if (needsAccount && !accountId) {
            return res.status(400).json({
                message: `A bank account is required for ${paymentMode} transactions.`
            });
        }

        let linkedReceivable = null;
        if (transactionType === 'inflow' && receivableId) {
            linkedReceivable = await Receivable.findById(receivableId);
            if (!linkedReceivable || linkedReceivable.userId.toString() !== req.user._id.toString()) {
                return res.status(400).json({ message: 'Invalid receivable selected.' });
            }
            if (linkedReceivable.status === 'received') {
                return res.status(400).json({ message: 'Selected receivable is already paid.' });
            }
        }

        const finalCategory = linkedReceivable ? 'Receivable' : (category || null);
        const finalMainCategory = linkedReceivable ? 'Others' : (mainCategory || 'Others');
        const finalSubCategory = linkedReceivable ? 'Receivable' : (subCategory || 'Others');

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
            category: finalCategory,
            mainCategory: finalMainCategory,
            subCategory: finalSubCategory
        });

        // ── Update receivable if linked ──────────────────────────────────────
        if (linkedReceivable) {
            linkedReceivable.status = 'received';
            linkedReceivable.receivedAt = date || new Date();
            linkedReceivable.transactionId = transaction._id;
            await linkedReceivable.save();
        }

        // ── Update bank account balance ───────────────────────────────────────
        // Cash and credit_card never touch bank balances.
        if (needsAccount && accountId) {
            await applyBalanceDelta(accountId, getBankDelta(transactionType, amount, cardId));
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
            .populate('cardId', 'cardName bankName billingDate')
            .populate('accountId', 'bankName accountName accountType lastFourDigits')
            .sort({ date: -1 });

        const today = new Date();

        const updatedTransactions = transactions.map(t => {
            if (t.paymentMode === 'credit_card' && t.cardId && t.cardId.billingDate && t.transactionType === 'expense') {
                const card = t.cardId;
                const billingDate = card.billingDate;

                // Calculate statement date for this transaction
                const txnDate = new Date(t.date);
                let year = txnDate.getFullYear();
                let month = txnDate.getMonth();
                if (txnDate.getDate() > billingDate) {
                    month += 1;
                    if (month > 11) {
                        month = 0;
                        year += 1;
                    }
                }
                const stmtDate = new Date(year, month, billingDate, 23, 59, 59, 999);

                // Calculate latest statement date
                let stmtYear = today.getFullYear();
                let stmtMonth = today.getMonth();
                if (today.getDate() < billingDate) {
                    stmtMonth -= 1;
                    if (stmtMonth < 0) {
                        stmtMonth = 11;
                        stmtYear -= 1;
                    }
                }
                const latestStatementDate = new Date(stmtYear, stmtMonth, billingDate, 23, 59, 59, 999);

                const billingStatus = stmtDate <= latestStatementDate ? 'billed' : 'unbilled';

                const tObj = t.toObject();
                tObj.billingStatus = billingStatus;
                return tObj;
            }
            return t;
        });

        res.status(200).json(updatedTransactions);

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
            expenseType, category, mainCategory, subCategory
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
                -getBankDelta(transaction.transactionType, transaction.amount, transaction.cardId)
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
            category: category || null,
            mainCategory: mainCategory || 'Others',
            subCategory: subCategory || 'Others'
        };

        const updatedTransaction = await Transaction.findByIdAndUpdate(
            req.params.id,
            updatedFields,
            { new: true }
        ).populate('cardId', 'cardName bankName')
         .populate('accountId', 'bankName accountName accountType lastFourDigits');

        // ── Step 3: Apply the NEW transaction's balance impact ────────────────
        if (needsAccount && accountId) {
            await applyBalanceDelta(accountId, getBankDelta(transactionType, amount, cardId));
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
                -getBankDelta(transaction.transactionType, transaction.amount, transaction.cardId)
            );
        }

        // Find if this transaction is linked to any receivable, and reset it
        await Receivable.findOneAndUpdate(
            { transactionId: transaction._id },
            { status: 'pending', receivedAt: null, transactionId: null }
        );

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
        const { cardId, paymentMode, accountId, amount } = req.body;
        if (!cardId) {
            return res.status(400).json({ message: 'Card ID is required' });
        }
        if (!paymentMode) {
            return res.status(400).json({ message: 'Payment mode is required' });
        }
        if (!['cash', 'upi', 'debit_card', 'bank_transfer'].includes(paymentMode)) {
            return res.status(400).json({ message: 'Invalid payment mode' });
        }

        const card = await Card.findById(cardId);
        if (!card) {
            return res.status(404).json({ message: 'Card not found' });
        }

        const needsAccount = BANK_LINKED_MODES.includes(paymentMode);
        if (needsAccount && !accountId) {
            return res.status(400).json({
                message: `A bank account is required for ${paymentMode} transactions.`
            });
        }

        if (needsAccount) {
            const account = await BankAccount.findById(accountId);
            if (!account || account.userId.toString() !== req.user._id.toString()) {
                return res.status(400).json({ message: 'Invalid bank account selected.' });
            }
        }

        // Fetch all transactions (expenses and inflows) for this card
        const cardTransactions = await Transaction.find({
            userId: req.user._id,
            cardId
        });

        const expenses = cardTransactions.filter(t => t.transactionType === 'expense');
        const payments = cardTransactions.filter(t => t.transactionType === 'inflow');
        const totalPayments = payments.reduce((sum, t) => sum + t.amount, 0);

        let finalAmount;
        if (amount !== undefined) {
            finalAmount = parseFloat(amount);
            if (isNaN(finalAmount) || finalAmount <= 0) {
                return res.status(400).json({ message: 'Payment amount must be a positive number.' });
            }
        } else {
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
            finalAmount = billedAmount;
        }

        // Create an inflow payment transaction of amount = finalAmount
        const paymentTxn = await Transaction.create({
            userId: req.user._id,
            name: `Card Payment - ${card.cardName}`,
            amount: finalAmount,
            date: new Date(),
            paymentMode,
            transactionType: 'inflow',
            cardId: card._id,
            accountId: needsAccount ? accountId : null,
            billingStatus: null,
            category: 'Others',
            mainCategory: 'Others',
            subCategory: 'Others'
        });

        if (needsAccount && accountId) {
            await applyBalanceDelta(accountId, -finalAmount);
        }

        res.status(200).json({
            message: 'Credit card bill paid successfully',
            payment: paymentTxn
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Bulk create itemized transactions from receipt scanner
 * @route   POST /api/transactions/batch
 * @access  Private
 */
const addBatchTransactions = async (req, res) => {
    try {
        const { items, paymentMode, bankAccountId, cardId, date, storeName, expenseType } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Please provide an array of itemized transactions.' });
        }

        const userId = req.user._id;
        const txnDate = date ? new Date(date) : new Date();

        // Validate paymentMode against enum
        const validModes = ['cash', 'upi', 'credit_card', 'debit_card', 'bank_transfer'];
        const safePaymentMode = (paymentMode && validModes.includes(paymentMode)) ? paymentMode : 'upi';

        // Check if bank account ID or card ID are valid ObjectIds
        const safeAccountId = (bankAccountId && bankAccountId !== 'null' && bankAccountId !== 'undefined') ? bankAccountId : null;
        const safeCardId = (cardId && cardId !== 'null' && cardId !== 'undefined') ? cardId : null;

        const createdTransactions = [];

        for (const item of items) {
            const rawDescription = item.description || item.name || 'Receipt Item';
            const rawAmount = item.amount || item.price;
            const numAmount = parseFloat(rawAmount);

            if (isNaN(numAmount) || numAmount <= 0) continue;

            const title = storeName ? `${storeName}: ${rawDescription}` : rawDescription;
            const mainCat = item.mainCategory || 'Home';
            const subCat = item.subCategory || 'Groceries';

            // Compute billing status for credit cards if cardId provided
            const billingStatus = (safePaymentMode === 'credit_card' && safeCardId) 
                ? await computeBillingStatus(safeCardId, txnDate) 
                : null;

            const txnData = {
                userId,
                name: title.trim(),
                amount: numAmount,
                transactionType: 'expense',
                paymentMode: safePaymentMode,
                accountId: BANK_LINKED_MODES.includes(safePaymentMode) ? safeAccountId : null,
                cardId: safePaymentMode === 'credit_card' ? safeCardId : null,
                category: subCat || mainCat || 'Groceries',
                mainCategory: mainCat,
                subCategory: subCat,
                expenseType: (expenseType === 'fixed' || expenseType === 'variable') ? expenseType : 'variable',
                date: txnDate,
                notes: 'Imported via Smart Receipt Scanner',
                billingStatus
            };

            const txn = await Transaction.create(txnData);

            // Adjust bank account balance if bank-linked mode
            if (safeAccountId && BANK_LINKED_MODES.includes(safePaymentMode)) {
                await applyBalanceDelta(safeAccountId, -numAmount);
            }

            createdTransactions.push(txn);
        }

        return res.status(201).json({
            success: true,
            count: createdTransactions.length,
            transactions: createdTransactions
        });

    } catch (error) {
        console.error('Error in addBatchTransactions:', error);
        return res.status(500).json({ message: 'Failed to batch save transactions', error: error.message });
    }
};

module.exports = { addTransaction, getTransactions, updateTransaction, deleteTransaction, payCardBill, addBatchTransactions };