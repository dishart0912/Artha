import { createContext, useContext, useState, useEffect } from 'react';

// 1. Create the context object
const AuthContext = createContext(null);

// 2. The Provider component — wraps your whole app
export function AuthProvider({ children }) {
  const [user, setUser]   = useState(null);   // { username, email }
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true); // prevents flash of wrong UI

  // On app load, check if a token already exists in localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('artha_token');
    const savedUser  = localStorage.getItem('artha_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = (userData, jwtToken) => {
    setUser(userData);
    setToken(jwtToken);
    localStorage.setItem('artha_token', jwtToken);
    localStorage.setItem('artha_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('artha_token');
    localStorage.removeItem('artha_user');
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token, // true if token exists
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// 3. Custom hook — so you never import useContext + AuthContext together
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}