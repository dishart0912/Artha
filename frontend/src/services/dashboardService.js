import api from './api';

export const getDashboard = async (month) => {
  const query = month ? `?month=${month}` : '';
  const response = await api.get(`/api/dashboard${query}`);
  return response.data;
};