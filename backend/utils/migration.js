const User = require('../models/User');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const RecurringExpense = require('../models/RecurringExpense');

const runMigration = async () => {
    try {
        console.log('--- Starting Unified Category Migration ---');
        
        // 1. Migrate Category documents: Merge income and expense subcategories
        const categories = await Category.find({});
        console.log(`Found ${categories.length} category documents to migrate.`);

        for (const cat of categories) {
            let catChanged = false;
            let subList = cat.subcategories || [];

            // If old fields exist, merge them
            const oldIncome = cat.get('incomeSubcategories');
            const oldExpense = cat.get('expenseSubcategories');

            if (oldIncome && Array.isArray(oldIncome) && oldIncome.length > 0) {
                subList = subList.concat(oldIncome);
                catChanged = true;
            }
            if (oldExpense && Array.isArray(oldExpense) && oldExpense.length > 0) {
                subList = subList.concat(oldExpense);
                catChanged = true;
            }

            // Remove case-insensitive duplicates
            const seen = new Set();
            const uniqueSubs = [];
            for (const sub of subList) {
                if (sub && !seen.has(sub.toLowerCase())) {
                    seen.add(sub.toLowerCase());
                    uniqueSubs.push(sub);
                }
            }

            // Ensure Others is present in Others category
            if (cat.name.toLowerCase() === 'others' && !seen.has('others')) {
                uniqueSubs.push('Others');
                catChanged = true;
            }

            if (catChanged || uniqueSubs.length !== (cat.subcategories || []).length) {
                cat.subcategories = uniqueSubs;
                // Delete legacy fields
                cat.set('incomeSubcategories', undefined);
                cat.set('expenseSubcategories', undefined);
                await cat.save();
                console.log(`Migrated category "${cat.name}" with subcategories: ${uniqueSubs.join(', ')}`);
            }
        }

        // 2. Ensure every User has an "Others" category
        const users = await User.find({});
        for (const user of users) {
            const userId = user._id;
            let othersCategory = await Category.findOne({ userId, name: { $regex: /^others$/i } });

            if (!othersCategory) {
                othersCategory = await Category.create({
                    userId,
                    name: 'Others',
                    subcategories: ['Others']
                });
                console.log(`Created default unified 'Others' category for user ${user.username}`);
            }
        }

        // 3. Migrate Transaction documents: Set mainCategory and subCategory to "Others" if not defined
        const txnResult = await Transaction.updateMany(
            {
                $or: [
                    { mainCategory: { $exists: false } },
                    { mainCategory: null },
                    { subCategory: { $exists: false } },
                    { subCategory: null }
                ]
            },
            {
                $set: {
                    mainCategory: 'Others',
                    subCategory: 'Others'
                }
            }
        );
        if (txnResult.modifiedCount > 0) {
            console.log(`Migrated ${txnResult.modifiedCount} transaction records to 'Others' > 'Others'.`);
        }

        // 4. Migrate RecurringExpense documents
        const recurringResult = await RecurringExpense.updateMany(
            {
                $or: [
                    { mainCategory: { $exists: false } },
                    { mainCategory: null },
                    { subCategory: { $exists: false } },
                    { subCategory: null }
                ]
            },
            {
                $set: {
                    mainCategory: 'Others',
                    subCategory: 'Others'
                }
            }
        );
        if (recurringResult.modifiedCount > 0) {
            console.log(`Migrated ${recurringResult.modifiedCount} recurring expense records.`);
        }

        console.log('--- Unified Category Migration Completed Successfully ---');
    } catch (error) {
        console.error('Error during Unified Category Migration:', error);
    }
};

module.exports = { runMigration };
