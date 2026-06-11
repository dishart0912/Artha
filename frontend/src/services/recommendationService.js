import api from './api';

export const getRecommendation = (category) =>
    api.get(`/api/recommend?category=${category}`).then(r => r.data);