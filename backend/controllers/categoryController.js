const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const RecurringExpense = require('../models/RecurringExpense');

const DEFAULT_CATEGORIES = [
    'Bills & Utilities',
    'Education',
    'Electricity',
    'EMI',
    'Entertainment',
    'Food & Dining',
    'Fuel',
    'Gas',
    'Groceries',
    'Health',
    'Insurance',
    'Internet',
    'Maintenance',
    'Other',
    'Rent',
    'Shopping',
    'Subscription',
    'Transport',
    'Travel',
    'Water'
];

const getCategories = async (req, res) => {
    try {
        const userId = req.user._id;
        let categories = await Category.find({ userId }).sort({ name: 1 });

        // If user has no categories, seed with defaults
        if (categories.length === 0) {
            const seedData = DEFAULT_CATEGORIES.map(name => ({ userId, name }));
            categories = await Category.insertMany(seedData);
            // Sort again
            categories.sort((a, b) => a.name.localeCompare(b.name));
        }

        res.status(200).json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const addCategory = async (req, res) => {
    try {
        const userId = req.user._id;
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Category name is required' });
        }

        const trimmedName = name.trim();

        // Check if category already exists (case-insensitive)
        const existing = await Category.findOne({
            userId,
            name: { $regex: new RegExp(`^${trimmedName}$`, 'i') }
        });

        if (existing) {
            return res.status(400).json({ message: 'Category already exists' });
        }

        const newCategory = new Category({
            userId,
            name: trimmedName
        });

        await newCategory.save();
        res.status(201).json(newCategory);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteCategory = async (req, res) => {
    try {
        const userId = req.user._id;
        const { name } = req.params;

        if (!name) {
            return res.status(400).json({ message: 'Category name is required' });
        }

        // Delete the category document
        const deleted = await Category.findOneAndDelete({ userId, name });

        if (!deleted) {
            return res.status(404).json({ message: 'Category not found' });
        }

        // Update transactions with this category to null
        await Transaction.updateMany(
            { userId, category: name },
            { $set: { category: null } }
        );

        // Update recurring expenses with this category to null
        await RecurringExpense.updateMany(
            { userId, category: name },
            { $set: { category: null } }
        );

        res.status(200).json({ message: 'Category deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getCategories,
    addCategory,
    deleteCategory
};
