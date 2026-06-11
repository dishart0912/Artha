const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

const receivableRoutes   = require('./routes/receivableRoutes');
const bankAccountRoutes  = require('./routes/bankAccountRoutes');
const recurringRoutes = require('./routes/recurringRoutes');

dotenv.config();
console.log("Loaded FATHER_USER_ID:", process.env.FATHER_USER_ID);
connectDB();

const app = express();

app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

//authentication  routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

//card routes
const cardRoutes = require('./routes/cardRoutes');
app.use('/api/cards', cardRoutes);

//transaction routes
const transactionRoutes = require('./routes/transactionRoutes');
app.use('/api/transactions', transactionRoutes);

//dashboard routes
const dashboardRoutes = require('./routes/dashboardRoutes');
app.use('/api/dashboard', dashboardRoutes);

const recommendationRoutes = require('./routes/recommendationRoutes');
app.use('/api/recommend', recommendationRoutes);


app.use('/api/receivables',    receivableRoutes);
app.use('/api/bank-accounts',  bankAccountRoutes);

app.use('/api/recurring', recurringRoutes);


app.get('/', (req, res) => {
    res.send('Artha API is running...');
});


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});