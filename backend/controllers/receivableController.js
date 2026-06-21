const Receivable = require('../models/Receivable');
const Transaction = require('../models/Transaction');
const BankAccount = require('../models/BankAccount');

const BANK_LINKED_MODES = ['upi', 'debit_card', 'bank_transfer'];

const addReceivable = async (req, res) => {
    try {
        const receivable = await Receivable.create({
            userId: req.user._id,
            ...req.body
        });
        res.status(201).json(receivable);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getReceivables = async (req, res) => {
    try {
        const receivables = await Receivable.find({ userId: req.user._id })
            .sort({ dueDate: 1 });
        res.status(200).json(receivables);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─── Mark Received — now creates a real Transaction record ──────────────────
// Expects in req.body: { paymentMode, accountId? }
const markReceived = async (req, res) => {
    try {
        const receivable = await Receivable.findById(req.params.id);
        if (!receivable) return res.status(404).json({ message: 'Not found' });
        if (receivable.userId.toString() !== req.user._id.toString())
            return res.status(401).json({ message: 'Not authorized' });

        if (receivable.status === 'received') {
            return res.status(400).json({ message: 'Already marked as received' });
        }

        const { paymentMode, accountId } = req.body;

        if (!paymentMode) {
            return res.status(400).json({ message: 'Payment mode is required' });
        }

        const needsAccount = BANK_LINKED_MODES.includes(paymentMode);
        if (needsAccount && !accountId) {
            return res.status(400).json({
                message: `A bank account is required for ${paymentMode} payments.`
            });
        }

        const now = new Date();

        // ── Create the linked transaction ──────────────────────────────────────
        const transaction = await Transaction.create({
            userId: req.user._id,
            name: `Payment from ${receivable.clientName}`,
            amount: receivable.amount,
            date: now,
            paymentMode,
            transactionType: 'inflow',
            accountId: needsAccount ? accountId : null,
            cardId: null,
            billingStatus: null,
            expenseType: null,
            category: 'Receivable'
        });

        // ── Update bank account balance ──────────────────────────────────────
        if (needsAccount && accountId) {
            await BankAccount.findByIdAndUpdate(accountId, { $inc: { balance: receivable.amount } });
        }

        // ── Update receivable status, link the transaction ──────────────────
        receivable.status      = 'received';
        receivable.receivedAt  = now;
        receivable.transactionId = transaction._id;
        await receivable.save();

        res.status(200).json({ receivable, transaction });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteReceivable = async (req, res) => {
    try {
        const receivable = await Receivable.findById(req.params.id);
        if (!receivable) return res.status(404).json({ message: 'Not found' });
        if (receivable.userId.toString() !== req.user._id.toString())
            return res.status(401).json({ message: 'Not authorized' });

        await Receivable.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { addReceivable, getReceivables, markReceived, deleteReceivable };