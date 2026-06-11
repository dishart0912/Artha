const Card = require('../models/Card');

// Add card
const addCard = async (req, res) => {
    try {
        const { cardName, bankName, cardType, creditLimit, 
                billingDate, dueDate, expiryDate, rewards } = req.body;

        const card = await Card.create({
            userId: req.user._id,
            cardName,
            bankName,
            cardType,
            creditLimit,
            billingDate,
            dueDate,
            expiryDate,
            rewards
        });

        res.status(201).json(card);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get all cards
const getCards = async (req, res) => {
    try {
        const cards = await Card.find({ userId: req.user._id });
        res.status(200).json(cards);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update card
const updateCard = async (req, res) => {
    try {
        const card = await Card.findById(req.params.id);

        if (!card) {
            return res.status(404).json({ message: 'Card not found' });
        }

        // Make sure user owns this card
        if (card.userId.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const updatedCard = await Card.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        res.status(200).json(updatedCard);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Delete card
const deleteCard = async (req, res) => {
    try {
        const card = await Card.findById(req.params.id);

        if (!card) {
            return res.status(404).json({ message: 'Card not found' });
        }

        // Make sure user owns this card
        if (card.userId.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        await Card.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Card removed' });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { addCard, getCards, updateCard, deleteCard };