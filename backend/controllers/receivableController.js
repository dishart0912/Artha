const Receivable = require('../models/Receivable');

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

const markReceived = async (req, res) => {
    try {
        const receivable = await Receivable.findById(req.params.id);
        if (!receivable) return res.status(404).json({ message: 'Not found' });
        if (receivable.userId.toString() !== req.user._id.toString())
            return res.status(401).json({ message: 'Not authorized' });

        receivable.status     = 'received';
        receivable.receivedAt = new Date();
        await receivable.save();

        res.status(200).json(receivable);
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