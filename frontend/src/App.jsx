import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages (we'll create these next)
import Login    from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Cards        from './pages/Cards';
import Transactions from './pages/Transactions';

import Receivables   from './pages/Receivables';
import BankAccounts  from './pages/BankAccounts';
import RecurringExpenses from './pages/RecurringExpenses';
import EMIs from './pages/EMIs';

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-sand" />; // blank while checking
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login"    element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/" replace /> : <Register />} />
      <Route path="/" element={
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      } />
      <Route path="/cards" element={
  <ProtectedRoute><Cards /></ProtectedRoute>
} />
<Route path="/transactions" element={
  <ProtectedRoute><Transactions /></ProtectedRoute>
} />
<Route path="/receivables"   element={<ProtectedRoute><Receivables /></ProtectedRoute>} />
<Route path="/bank-accounts" element={<ProtectedRoute><BankAccounts /></ProtectedRoute>} />
   <Route path="/recurring" element={
  <ProtectedRoute><RecurringExpenses /></ProtectedRoute>
} />
<Route path="/emis" element={<EMIs />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}