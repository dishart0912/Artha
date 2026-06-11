const BankAccount = require('../models/BankAccount');

const addBankAccount = async (req, res) => {
    try {
        const account = await BankAccount.create({
            userId: req.user._id,
            ...req.body
        });
        res.status(201).json(account);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getBankAccounts = async (req, res) => {
    try {
        const accounts = await BankAccount.find({ userId: req.user._id });
        res.status(200).json(accounts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateBankAccount = async (req, res) => {
    try {
        const account = await BankAccount.findById(req.params.id);
        if (!account) return res.status(404).json({ message: 'Not found' });
        if (account.userId.toString() !== req.user._id.toString())
            return res.status(401).json({ message: 'Not authorized' });

        const updated = await BankAccount.findByIdAndUpdate(
            req.params.id, req.body, { new: true }
        );
        res.status(200).json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteBankAccount = async (req, res) => {
    try {
        const account = await BankAccount.findById(req.params.id);
        if (!account) return res.status(404).json({ message: 'Not found' });
        if (account.userId.toString() !== req.user._id.toString())
            return res.status(401).json({ message: 'Not authorized' });

        await BankAccount.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { addBankAccount, getBankAccounts, updateBankAccount, deleteBankAccount };