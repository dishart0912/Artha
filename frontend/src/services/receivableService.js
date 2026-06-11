import api from './api';

export const getReceivables    = ()    => api.get('/api/receivables').then(r => r.data);
export const addReceivable     = (data) => api.post('/api/receivables', data).then(r => r.data);
export const markReceived      = (id)  => api.patch(`/api/receivables/${id}/received`).then(r => r.data);
export const deleteReceivable  = (id)  => api.delete(`/api/receivables/${id}`).then(r => r.data);