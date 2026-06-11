import api from './api';

export const getRecurring   = ()    => api.get('/api/recurring').then(r => r.data);
export const addRecurring   = (data) => api.post('/api/recurring', data).then(r => r.data);
export const markPaid       = (id)  => api.patch(`/api/recurring/${id}/paid`).then(r => r.data);
export const markUnpaid     = (id)  => api.patch(`/api/recurring/${id}/unpaid`).then(r => r.data);
export const deleteRecurring = (id) => api.delete(`/api/recurring/${id}`).then(r => r.data);
