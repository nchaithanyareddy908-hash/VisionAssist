import axios from 'axios';

const API_URL =
  import.meta.env.VITE_API_URL ||
  'https://visionassist-eoi8.onrender.com';

const api = axios.create({
  baseURL: API_URL,
  timeout: 120000,
});

export const healthCheck = async () => {
  return api.get('/api/health');
};

export const uploadAnalysis = async (endpoint, file) => {
  if (!file) {
    throw new Error('No image file was created.');
  }

  const formData = new FormData();
  formData.append('file', file, 'capture.jpg');

  return api.post(`/api/${endpoint}`, formData);
};

export const getHistory = async () => {
  return api.get('/api/history');
};

export const saveHistory = async (analysisType, result) => {
  return api.post('/api/history', {
    analysis_type: analysisType,
    result: result,
  });
};

export const deleteHistoryItem = async (id) => {
  return api.delete(`/api/history/${id}`);
};

export const clearHistory = async () => {
  return api.delete('/api/history');
};