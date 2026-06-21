const EMI = require('../models/EMI');

// ─── Helper: generate installment schedule ───────────────────────────────────
// Builds N installments starting from startDate, one per month, same amount.
const generateInstallments = (startDate, monthlyAmount, tenureMonths) => {
    const installments = [];
    const start = new Date(startDate);

    for (let i = 0; i < tenureMonths; i++) {
        const dueDate = new Date(start.getFullYear(), start.getMonth() + i, start.getDate());
        installments.push({
            installmentNumber: i + 1,
            dueDate,
            amount: monthlyAmount,
            status: 'pending',
            paidAt: null
        });
    }
    return installments;
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/emis
// ─────────────────────────────────────────────────────────────────────────────
const addEMI = async (req, res) => {
    try {
        const {
            title, loanType, cardId,
            principalAmount, monthlyAmount, tenureMonths,
            interestRate, startDate, lenderName
        } = req.body;

        if (!title || !loanType || !principalAmount || !monthlyAmount || !tenureMonths || !startDate) {
            return res.status(400).json({ message: 'Missing required EMI fields' });
        }

        if (loanType === 'credit_card' && !cardId) {
            return res.status(400).json({ message: 'cardId is required for credit_card EMIs' });
        }

        const installments = generateInstallments(startDate, monthlyAmount, tenureMonths);

        const emi = await EMI.create({
            userId: req.user._id,
            title,
            loanType,
            cardId: loanType === 'credit_card' ? cardId : null,
            principalAmount,
            monthlyAmount,
            tenureMonths,
            interestRate: interestRate || 0,
            startDate,
            lenderName: lenderName || null,
            installments,
            status: 'active'
        });

        res.status(201).json(emi);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/emis
// ─────────────────────────────────────────────────────────────────────────────
const getEMIs = async (req, res) => {
    try {
        const emis = await EMI.find({ userId: req.user._id })
            .populate('cardId', 'cardName bankName')
            .sort({ createdAt: -1 });

        res.status(200).json(emis);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/emis/:id/installments/:installmentId/paid
// Marks a single installment as paid
// ─────────────────────────────────────────────────────────────────────────────
const markInstallmentPaid = async (req, res) => {
    try {
        const emi = await EMI.findById(req.params.id);
        if (!emi) return res.status(404).json({ message: 'EMI not found' });
        if (emi.userId.toString() !== req.user._id.toString())
            return res.status(401).json({ message: 'Not authorized' });

        const installment = emi.installments.id(req.params.installmentId);
        if (!installment) return res.status(404).json({ message: 'Installment not found' });

        if (installment.status === 'paid') {
            return res.status(400).json({ message: 'Installment already marked as paid' });
        }

        installment.status = 'paid';
        installment.paidAt = new Date();

        // ── Auto-close the EMI if every installment is now paid ──────────────────
        const allPaid = emi.installments.every(inst => inst.status === 'paid');
        if (allPaid) {
            emi.status = 'closed';
        }

        await emi.save();

        res.status(200).json(emi);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/emis/:id/installments/:installmentId/amount
// Updates the amount of a single installment (for rate revisions, one-off changes)
// Only allowed while the installment is still pending — paid installments are history.
// ─────────────────────────────────────────────────────────────────────────────
const updateInstallmentAmount = async (req, res) => {
    try {
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: 'A valid amount is required' });
        }

        const emi = await EMI.findById(req.params.id);
        if (!emi) return res.status(404).json({ message: 'EMI not found' });
        if (emi.userId.toString() !== req.user._id.toString())
            return res.status(401).json({ message: 'Not authorized' });

        const installment = emi.installments.id(req.params.installmentId);
        if (!installment) return res.status(404).json({ message: 'Installment not found' });

        if (installment.status === 'paid') {
            return res.status(400).json({ message: 'Cannot edit amount of a paid installment' });
        }

        installment.amount = amount;
        await emi.save();

        res.status(200).json(emi);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/emis/:id
// ─────────────────────────────────────────────────────────────────────────────
const deleteEMI = async (req, res) => {
    try {
        const emi = await EMI.findById(req.params.id);
        if (!emi) return res.status(404).json({ message: 'EMI not found' });
        if (emi.userId.toString() !== req.user._id.toString())
            return res.status(401).json({ message: 'Not authorized' });

        await EMI.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'EMI deleted' });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { addEMI, getEMIs, markInstallmentPaid, updateInstallmentAmount, deleteEMI };