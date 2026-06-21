import api from './api';

export const getEMIs              = ()                     => api.get('/api/emis').then(r => r.data);
export const addEMI               = (data)                 => api.post('/api/emis', data).then(r => r.data);
export const markInstallmentPaid  = (emiId, installmentId) => api.patch(`/api/emis/${emiId}/installments/${installmentId}/paid`).then(r => r.data);
export const updateInstallmentAmount = (emiId, installmentId, amount) => api.patch(`/api/emis/${emiId}/installments/${installmentId}/amount`, { amount }).then(r => r.data);
export const deleteEMI            = (id)                   => api.delete(`/api/emis/${id}`).then(r => r.data);