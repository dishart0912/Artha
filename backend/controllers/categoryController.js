const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const RecurringExpense = require('../models/RecurringExpense');

const DEFAULT_CATEGORIES = [
    {
        name: 'Others',
        subcategories: ['Others']
    },
    {
        name: 'Home',
        subcategories: ['Rental Income', 'Deposit Refund', 'Groceries', 'Electricity', 'Water Bill', 'Rent', 'Maintenance']
    },
    {
        name: 'Business',
        subcategories: ['Client Payment', 'Product Sales', 'Commission', 'Office Rent', 'Internet', 'Salaries', 'Equipment']
    },
    {
        name: 'Personal',
        subcategories: ['Salary', 'Gifts', 'Food', 'Shopping', 'Entertainment', 'Travel']
    }
];

const getCategories = async (req, res) => {
    try {
        const userId = req.user._id;
        let categories = await Category.find({ userId }).sort({ name: 1 });

        // If user has no categories, seed with defaults
        if (categories.length === 0) {
            const seedData = DEFAULT_CATEGORIES.map(cat => ({
                userId,
                name: cat.name,
                subcategories: cat.subcategories
            }));
            categories = await Category.insertMany(seedData);
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
            name: trimmedName,
            subcategories: ['Others']
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
        const { reassignTo } = req.query;

        if (!name) {
            return res.status(400).json({ message: 'Category name is required' });
        }

        // Check if transactions exist under this main category
        const transactionsCount = await Transaction.countDocuments({ userId, mainCategory: name });
        const recurringCount = await RecurringExpense.countDocuments({ userId, mainCategory: name });

        if (transactionsCount > 0 || recurringCount > 0) {
            if (!reassignTo) {
                return res.status(400).json({
                    message: `Category "${name}" contains transactions or recurring expenses. Please reassign them before deleting.`,
                    hasTransactions: true
                });
            }

            // Verify reassignTo category exists
            const reassignCategory = await Category.findOne({ userId, name: reassignTo });
            if (!reassignCategory) {
                return res.status(400).json({ message: `Reassignment target category "${reassignTo}" not found.` });
            }

            // Update transactions to target main category, fallback subCategory to 'Others'
            await Transaction.updateMany(
                { userId, mainCategory: name },
                { $set: { mainCategory: reassignTo, subCategory: 'Others' } }
            );

            // Update recurring expenses to target main category
            await RecurringExpense.updateMany(
                { userId, mainCategory: name },
                { $set: { mainCategory: reassignTo, subCategory: 'Others' } }
            );
        }

        // Delete the category document
        const deleted = await Category.findOneAndDelete({ userId, name });

        if (!deleted) {
            return res.status(404).json({ message: 'Category not found' });
        }

        res.status(200).json({ message: 'Category deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateCategory = async (req, res) => {
    try {
        const userId = req.user._id;
        const { name } = req.params;
        const { newName } = req.body;

        if (!name || !newName || !newName.trim()) {
            return res.status(400).json({ message: 'Category name and new name are required' });
        }

        const trimmedNewName = newName.trim();

        // Check if category already exists (case-insensitive) for the user
        const existing = await Category.findOne({
            userId,
            name: { $regex: new RegExp(`^${trimmedNewName}$`, 'i') }
        });

        if (existing && existing.name.toLowerCase() !== name.toLowerCase()) {
            return res.status(400).json({ message: 'Category already exists' });
        }

        // Update the category document
        const updated = await Category.findOneAndUpdate(
            { userId, name },
            { name: trimmedNewName },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ message: 'Category not found' });
        }

        // Update transactions with this category to new name
        await Transaction.updateMany(
            { userId, mainCategory: name },
            { $set: { mainCategory: trimmedNewName } }
        );

        // Update recurring expenses with this category to new name
        await RecurringExpense.updateMany(
            { userId, mainCategory: name },
            { $set: { mainCategory: trimmedNewName } }
        );

        res.status(200).json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ── Subcategory Management API ──

const addSubcategory = async (req, res) => {
    try {
        const userId = req.user._id;
        const { name } = req.params; // Main category name
        const { name: subName } = req.body;

        if (!subName || !subName.trim()) {
            return res.status(400).json({ message: 'Subcategory name is required.' });
        }

        const trimmedSubName = subName.trim();
        const category = await Category.findOne({ userId, name });

        if (!category) {
            return res.status(404).json({ message: 'Main Category not found.' });
        }
        
        // Case-insensitive duplicate check
        const exists = category.subcategories.some(sub => sub.toLowerCase() === trimmedSubName.toLowerCase());
        if (exists) {
            return res.status(400).json({ message: 'Subcategory already exists.' });
        }

        category.subcategories.push(trimmedSubName);
        await category.save();

        res.status(200).json(category);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateSubcategory = async (req, res) => {
    try {
        const userId = req.user._id;
        const { name, subName } = req.params; // Main Category and current subcategory name
        const { newName } = req.body;

        if (!newName || !newName.trim()) {
            return res.status(400).json({ message: 'New subcategory name is required.' });
        }

        const trimmedNewName = newName.trim();
        const category = await Category.findOne({ userId, name });

        if (!category) {
            return res.status(404).json({ message: 'Main Category not found.' });
        }

        const index = category.subcategories.indexOf(subName);

        if (index === -1) {
            return res.status(404).json({ message: 'Subcategory not found.' });
        }

        // Duplicate check
        const exists = category.subcategories.some((sub, i) => i !== index && sub.toLowerCase() === trimmedNewName.toLowerCase());
        if (exists) {
            return res.status(400).json({ message: 'Subcategory already exists.' });
        }

        // Update the array
        category.subcategories[index] = trimmedNewName;
        await category.save();

        // Update corresponding transactions
        await Transaction.updateMany(
            { userId, mainCategory: name, subCategory: subName },
            { $set: { subCategory: trimmedNewName } }
        );

        // Update corresponding recurring expenses (always expenses)
        await RecurringExpense.updateMany(
            { userId, mainCategory: name, subCategory: subName },
            { $set: { subCategory: trimmedNewName } }
        );

        res.status(200).json(category);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteSubcategory = async (req, res) => {
    try {
        const userId = req.user._id;
        const { name, subName } = req.params; // Main Category name and subcategory to delete
        const { reassignTo } = req.query;

        const category = await Category.findOne({ userId, name });
        if (!category) {
            return res.status(404).json({ message: 'Main Category not found.' });
        }

        const index = category.subcategories.indexOf(subName);

        if (index === -1) {
            return res.status(404).json({ message: 'Subcategory not found.' });
        }

        // Check if transactions exist for this subcategory
        const transactionsCount = await Transaction.countDocuments({
            userId,
            mainCategory: name,
            subCategory: subName
        });
        const recurringCount = await RecurringExpense.countDocuments({
            userId,
            mainCategory: name,
            subCategory: subName
        });

        if (transactionsCount > 0 || recurringCount > 0) {
            if (!reassignTo) {
                return res.status(400).json({
                    message: `Subcategory "${subName}" contains transactions or recurring expenses. Please reassign them before deleting.`,
                    hasTransactions: true
                });
            }

            // Verify reassignTo subcategory exists
            const targetExists = category.subcategories.includes(reassignTo);
            if (!targetExists) {
                return res.status(400).json({ message: `Reassignment target subcategory "${reassignTo}" not found.` });
            }

            // Reassign transactions
            await Transaction.updateMany(
                { userId, mainCategory: name, subCategory: subName },
                { $set: { subCategory: reassignTo } }
            );

            // Reassign recurring expenses
            await RecurringExpense.updateMany(
                { userId, mainCategory: name, subCategory: subName },
                { $set: { subCategory: reassignTo } }
            );
        }

        // Remove subcategory from list
        category.subcategories.splice(index, 1);
        await category.save();

        res.status(200).json(category);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const bulkDeleteCategories = async (req, res) => {
    try {
        const userId = req.user._id;
        const { mainCategories = [], subcategories = [] } = req.body;

        const issues = [];

        // Check main categories
        for (const mainName of mainCategories) {
            const txCount = await Transaction.countDocuments({ userId, mainCategory: mainName });
            const recCount = await RecurringExpense.countDocuments({ userId, mainCategory: mainName });
            if (txCount > 0 || recCount > 0) {
                issues.push(`Category "${mainName}" has ${txCount + recCount} active transaction(s)/recurring expense(s).`);
            }
        }

        // Check subcategories
        for (const sub of subcategories) {
            const txCount = await Transaction.countDocuments({ 
                userId, 
                mainCategory: sub.mainCategory, 
                subCategory: sub.subName 
            });
            const recCount = await RecurringExpense.countDocuments({ 
                userId, 
                mainCategory: sub.mainCategory, 
                subCategory: sub.subName 
            });
            if (txCount > 0 || recCount > 0) {
                issues.push(`Subcategory "${sub.subName}" under "${sub.mainCategory}" has ${txCount + recCount} active transaction(s)/recurring expense(s).`);
            }
        }

        if (issues.length > 0) {
            return res.status(400).json({
                message: "Some selected categories or subcategories contain transactions or recurring expenses. Please reassign them first.",
                issues,
                hasTransactions: true
            });
        }

        // Perform deletions
        if (mainCategories.length > 0) {
            await Category.deleteMany({ userId, name: { $in: mainCategories } });
        }

        for (const sub of subcategories) {
            const category = await Category.findOne({ userId, name: sub.mainCategory });
            if (category) {
                const index = category.subcategories.indexOf(sub.subName);
                if (index !== -1) {
                    category.subcategories.splice(index, 1);
                    await category.save();
                }
            }
        }

        res.status(200).json({ message: "Successfully deleted selected categories." });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getCategories,
    addCategory,
    deleteCategory,
    updateCategory,
    addSubcategory,
    updateSubcategory,
    deleteSubcategory,
    bulkDeleteCategories
};
