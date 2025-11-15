import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api'
});

export const api = {
  uploadVideo: (formData) => API.post('/video/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  processVideo: (videoId) => API.post(`/video/process/${videoId}`),
  getVideoResults: (videoId) => API.get(`/video/results/${videoId}`),

  getAllPersons: () => API.get('/persons'),
  addPerson: (data) => API.post('/persons', data),
  updatePerson: (id, data) => API.put(`/persons/${id}`, data),
  deletePerson: (id) => API.delete(`/persons/${id}`),

  getOverview: () => API.get('/stats/overview'),
  getAlerts: () => API.get('/stats/alerts')
};
