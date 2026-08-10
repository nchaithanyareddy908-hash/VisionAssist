import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

export const healthCheck = async () => api.get('/api/health');

export const uploadAnalysis = async (endpoint, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/api/${endpoint}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const getHistory = async () => api.get('/api/history');

export const saveHistory = async (analysisType, result) =>
  api.post('/api/history', {
    analysis_type: analysisType,
    result,
  });

export const deleteHistoryItem = async (id) => api.delete(`/api/history/${id}`);

export const clearHistory = async () => api.delete('/api/history');
