import api from './api';

export const getCategories = () => api.get('/api/categories').then(r => r.data);
export const addCategory = (name) => api.post('/api/categories', { name }).then(r => r.data);

export const deleteCategory = (name, reassignTo) => {
    const query = reassignTo ? `?reassignTo=${encodeURIComponent(reassignTo)}` : '';
    return api.delete(`/api/categories/${encodeURIComponent(name)}${query}`).then(r => r.data);
};

export const updateCategory = (name, newName) => api.put(`/api/categories/${encodeURIComponent(name)}`, { newName }).then(r => r.data);

// Subcategory service endpoints
export const addSubcategory = (mainCategory, subName) => 
    api.post(`/api/categories/${encodeURIComponent(mainCategory)}/subcategories`, { name: subName }).then(r => r.data);

export const updateSubcategory = (mainCategory, oldSubName, newSubName) => 
    api.put(`/api/categories/${encodeURIComponent(mainCategory)}/subcategories/${encodeURIComponent(oldSubName)}`, { newName: newSubName }).then(r => r.data);

export const deleteSubcategory = (mainCategory, subName, reassignTo) => {
    const query = reassignTo ? `?reassignTo=${encodeURIComponent(reassignTo)}` : '';
    return api.delete(`/api/categories/${encodeURIComponent(mainCategory)}/subcategories/${encodeURIComponent(subName)}${query}`).then(r => r.data);
};

// Bulk Delete service
export const bulkDeleteCategories = (mainCategories, subcategories) =>
    api.post('/api/categories/bulk-delete', { mainCategories, subcategories }).then(r => r.data);

// AI Category Predictor
export const predictCategory = (name) =>
    api.post('/api/categories/predict', { name }).then(r => r.data);
