import axios from 'axios';

// Base instance — all API calls go through this
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — runs before EVERY request
// Automatically attaches the JWT token if it exists
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('artha_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — runs after EVERY response
// If the server returns 401 (token expired), log the user out
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('artha_token');
      localStorage.removeItem('artha_user');
      window.location.href = '/login'; // hard redirect
    }
    return Promise.reject(error);
  }
);

export default api;