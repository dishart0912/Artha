const Card = require('../models/Card');
const Transaction = require('../models/Transaction');

const getRecommendation = async (req, res) => {
    try {
        const userId = req.user._id;
        const { category } = req.query;

        // Get all user's cards
        const cards = await Card.find({ userId });

        if (cards.length === 0) {
            return res.status(404).json({ message: 'No cards found' });
        }

        const today = new Date();
        const currentDay = today.getDate();

        // Score each card
        const scoredCards = await Promise.all(cards.map(async (card) => {

            // Calculate current outstanding
            const cardTransactions = await Transaction.find({
                userId,
                cardId: card._id,
                paymentMode: 'credit_card'
            });

            const outstanding = cardTransactions
                .reduce((sum, t) => sum + t.amount, 0);

            const utilization = (outstanding / card.creditLimit) * 100;

            // Skip cards with >80% utilization
            if (utilization > 80) {
                return null;
            }

            // Days remaining in billing cycle
            let daysRemaining;
            if (currentDay <= card.billingDate) {
                daysRemaining = card.billingDate - currentDay;
            } else {
                const daysInMonth = new Date(
                    today.getFullYear(),
                    today.getMonth() + 1,
                    0
                ).getDate();
                daysRemaining = (daysInMonth - currentDay) + card.billingDate;
            }

            // Check rewards match category
            const rewardsMatch = category && card.rewards
                ? card.rewards.toLowerCase().includes(category.toLowerCase())
                : false;

            // Calculate score
            let score = 0;
            score += daysRemaining * 2;        // more days = better
            score += (100 - utilization);      // lower utilization = better
            if (rewardsMatch) score += 50;     // bonus for category match

            return {
                cardId:       card._id,
                cardName:     card.cardName,
                bankName:     card.bankName,
                creditLimit:  card.creditLimit,
                outstanding:  outstanding,
                utilization:  `${utilization.toFixed(2)}%`,
                daysRemaining,
                rewardsMatch,
                rewards:      card.rewards,
                score
            };
        }));

        // Remove null (high utilization cards) and sort by score
        const validCards = scoredCards
            .filter(card => card !== null)
            .sort((a, b) => b.score - a.score);

        if (validCards.length === 0) {
            return res.status(200).json({
                message: 'All cards are above 80% utilization. Consider paying dues first.',
                recommendation: null
            });
        }

        res.status(200).json({
            recommendation: validCards[0],
            allCards: validCards
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getRecommendation };