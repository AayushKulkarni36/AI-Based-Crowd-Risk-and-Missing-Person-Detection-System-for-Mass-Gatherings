import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:8000'
});

export const api = {
  // Video Analysis
  uploadVideo: (formData) => API.post('/upload_video', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  processVideo: (videoId) => Promise.resolve({ data: { message: "Started" } }), // Auto-started on upload
  getVideoResults: (videoId) => API.get(`/status/${videoId}`),

  // Missing Persons
  getAllPersons: () => API.get('/missing_persons'),
  addPerson: (formData) => API.post('/register_missing_person', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),

  // Stubs
  updatePerson: (id, data) => Promise.resolve(),
  deletePerson: (id) => Promise.resolve(),
  getOverview: () => Promise.resolve({ data: {} }),
  getAlerts: () => Promise.resolve({ data: [] })
};
