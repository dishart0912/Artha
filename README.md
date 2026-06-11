# 💰 Artha - Personal Finance & Credit Card Management Platform

Artha is a full-stack personal finance management platform built using the MERN stack. It helps users manage expenses, income, bank accounts, recurring expenses, receivables, and multiple credit cards while tracking billing cycles and spending patterns.

The project was inspired by a real-world use case of managing multiple credit cards, tracking billed and unbilled transactions, monitoring due dates, and maintaining complete financial visibility from a single dashboard.

---

## 🚀 Features

### 📊 Dashboard
- Financial overview with key metrics
- Income vs Expense tracking
- Spending analytics and visualizations
- Monthly financial summaries

### 💳 Credit Card Management
- Manage multiple credit cards
- Store billing dates and due dates
- Track card-wise spending
- Monitor billed vs unbilled transactions
- Credit limit management

### 💸 Transaction Management
- Add income and expenses
- Categorize transactions
- Card-linked transactions
- Search and filter functionality
- Transaction history

### 🏦 Bank Account Management
- Track multiple bank accounts
- Monitor account balances
- Associate transactions with accounts

### 🔁 Recurring Expenses
- Manage fixed monthly expenses
- Track subscriptions and bills
- Monthly expense planning

### 📥 Receivables Management
- Track money owed by clients/customers
- Pending payment monitoring
- Due date tracking

### 🔐 Authentication
- User registration and login
- JWT-based authentication
- Protected routes

### 📱 Responsive Design
- Mobile-friendly interface
- Modern dashboard UI
- Optimized user experience

---

## 🛠️ Tech Stack

### Frontend
- React.js
- React Router
- Tailwind CSS
- Axios
- Chart.js

### Backend
- Node.js
- Express.js
- JWT Authentication
- REST APIs

### Database
- MongoDB
- Mongoose ODM

### Deployment
- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas

---

## 📂 Project Structure

```text
Artha/
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── utils/
│   └── server.js
│
└── README.md
```

---

## ⚙️ Installation

### Clone Repository

```bash
git clone <repository-url>
cd Artha
```

### Backend Setup

```bash
cd backend
npm install
```

Create `.env`

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
```

Start Backend

```bash
npm start
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```
## 📸 Screenshots

<img width="1888" height="1005" alt="image" src="https://github.com/user-attachments/assets/61b73376-de97-48cf-a596-4578b950395e" />
<img width="1905" height="997" alt="image" src="https://github.com/user-attachments/assets/d7f8a375-9507-47ca-806e-f70d12b61f5d" />
<img width="1917" height="1013" alt="image" src="https://github.com/user-attachments/assets/51fc4355-341b-4a45-8bb5-8a91adf12ab5" />
<img width="1910" height="1019" alt="image" src="https://github.com/user-attachments/assets/6c5bd2be-8160-46ad-9c9f-d8d2cd24ca5d" />

## 👩‍💻 Author

**Disha Takawale**

Computer Engineering Student | Full Stack Developer | UI/UX Designer

Portfolio: https://disha-takawale-portfolio.netlify.app

LinkedIn: www.linkedin.com/in/dishatakawale

---

## ⭐ Motivation

This project was built to solve a real-world financial management problem involving multiple credit cards, billing cycles, recurring expenses, and business-related expense tracking. It combines practical financial workflows with modern web technologies to create a centralized personal finance management system.
