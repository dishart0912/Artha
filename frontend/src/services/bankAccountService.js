import api from './api';

export const getBankAccounts   = ()         => api.get('/api/bank-accounts').then(r => r.data);
export const addBankAccount    = (data)     => api.post('/api/bank-accounts', data).then(r => r.data);
export const updateBankAccount = (id, data) => api.put(`/api/bank-accounts/${id}`, data).then(r => r.data);
export const deleteBankAccount = (id)       => api.delete(`/api/bank-accounts/${id}`).then(r => r.data);