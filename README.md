# 💰 Artha - Personal Finance & Credit Card Management Platform

Artha is a full-stack personal finance management platform built using the MERN stack and Python. It helps users manage expenses, income, bank accounts, recurring expenses, receivables, and multiple credit cards while tracking billing cycles and spending patterns.

The project features a **Machine Learning Microservice** that automates data entry by parsing digital and physical receipts, extracting line items, and predicting custom expense categories on the fly using a zero-shot similarity engine.

---

## 🚀 Features

### 🤖 Smart Receipt Scanner & AI Categorization
- **Upload Bills:** Drag and drop physical receipts (images) or digital invoices (PDFs from Swiggy, Zepto, Blinkit).
- **Native PDF Parsing:** High-performance, zero-OCR extraction for digital PDFs using PyMuPDF to save memory and processing time.
- **OCR Fallback:** OpenCV and RapidOCR pipeline for scanning physical paper receipts.
- **Dynamic AI Matching:** Zero-Shot NLP engine (TF-IDF & Cosine Similarity) instantly maps extracted items to your custom user-defined categories.
- **Batch Editing:** Review, edit, and bulk-save entire shopping lists in one click.

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
- Modern glassmorphism dashboard UI
- Optimized user experience

---

## 🛠️ Tech Stack

### Frontend
- React.js
- Vite
- React Router
- Tailwind CSS
- Axios
- Chart.js

### Backend (Node.js API)
- Node.js
- Express.js
- JWT Authentication
- REST APIs

### Machine Learning (Python Microservice)
- Python
- Flask
- Scikit-Learn (TF-IDF, Logistic Regression, Cosine Similarity)
- PyMuPDF (fitz)
- OpenCV & RapidOCR (ONNX)

### Database
- MongoDB
- Mongoose ODM

### Deployment
- Frontend: Vercel
- Backend: Render
- ML Service: Render
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
├── ml_service/
│   ├── receipt_scanner/
│   ├── app.py
│   ├── dynamic_matcher.py
│   └── requirements.txt
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

### 1. Database Setup
Create a `.env` file in the `backend` folder:
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
```

### 2. Backend Setup

```bash
cd backend
npm install
npm start
```

### 3. ML Service Setup

```bash
cd ml_service
pip install -r requirements.txt
python app.py
```
*(The ML service runs locally on port 5001 by default)*

### 4. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```


## 👩‍💻 Author

**Disha Takawale**

Computer Engineering Student | Full Stack Developer | UI/UX Designer

Portfolio: https://disha-takawale-portfolio.netlify.app

LinkedIn: www.linkedin.com/in/dishatakawale

---

## ⭐ Motivation

This project was built to solve a real-world financial management problem involving multiple credit cards, billing cycles, recurring expenses, and business-related expense tracking. It combines practical financial workflows with modern web technologies and machine learning to create a centralized, automated personal finance management system.
```
