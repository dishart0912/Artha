import api from './api';

export const getTransactions  = ()         => api.get('/api/transactions').then(r => r.data);
export const addTransaction   = (data)     => api.post('/api/transactions', data).then(r => r.data);
export const updateTransaction = (id, data) => api.put(`/api/transactions/${id}`, data).then(r => r.data);
export const deleteTransaction = (id)      => api.delete(`/api/transactions/${id}`).then(r => r.data);