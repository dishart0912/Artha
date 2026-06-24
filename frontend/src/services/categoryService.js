import api from './api';

export const getCategories = () => api.get('/api/categories').then(r => r.data);
export const addCategory = (name) => api.post('/api/categories', { name }).then(r => r.data);
export const deleteCategory = (name) => api.delete(`/api/categories/${encodeURIComponent(name)}`).then(r => r.data);
