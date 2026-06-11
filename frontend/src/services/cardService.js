import api from './api';

export const getCards    = ()        => api.get('/api/cards').then(r => r.data);
export const addCard     = (data)    => api.post('/api/cards', data).then(r => r.data);
export const updateCard  = (id, data)=> api.put(`/api/cards/${id}`, data).then(r => r.data);
export const deleteCard  = (id)      => api.delete(`/api/cards/${id}`).then(r => r.data);