const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__filename, '..', '.env') });

const Transaction = require('./models/Transaction');

async function testBatchCreate() {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/artha';
    await mongoose.connect(mongoUri);
    print = console.log;
    print('[TEST] Connected to MongoDB!');

    const sampleItems = [
        {
            description: "Amul Gold Pasteurised Full",
            amount: 72.0,
            mainCategory: "Home",
            subCategory: "Milk & Dairy"
        },
        {
            description: "Handling Fee",
            amount: 12.02,
            mainCategory: "Home",
            subCategory: "Groceries"
        }
    ];

    const storeName = "Swiggy Instamart";
    const paymentMode = "upi";
    const userId = new mongoose.Types.ObjectId();

    try {
        for (const item of sampleItems) {
            const rawDescription = item.description || item.name || 'Receipt Item';
            const rawAmount = item.amount || item.price;
            const numAmount = parseFloat(rawAmount);

            const title = storeName ? `${storeName}: ${rawDescription}` : rawDescription;
            const mainCat = item.mainCategory || 'Home';
            const subCat = item.subCategory || 'Groceries';

            const txnData = {
                userId,
                name: title.trim(),
                amount: numAmount,
                transactionType: 'expense',
                paymentMode: 'upi',
                accountId: null,
                cardId: null,
                category: subCat || mainCat || 'Groceries',
                mainCategory: mainCat,
                subCategory: subCat,
                expenseType: 'variable',
                date: new Date(),
                notes: 'Imported via Smart Receipt Scanner'
            };

            const created = await Transaction.create(txnData);
            print(`[SUCCESS] Created Transaction: ID=${created._id}, Name='${created.name}', Amount=Rs.${created.amount}`);
        }
    } catch (err) {
        print(`[ERROR] Transaction creation failed:`, err);
    } finally {
        await mongoose.disconnect();
    }
}

testBatchCreate();
