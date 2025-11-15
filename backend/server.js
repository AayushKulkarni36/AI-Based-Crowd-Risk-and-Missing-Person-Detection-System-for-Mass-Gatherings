import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import videoRoutes from './routes/video.routes.js';
import personRoutes from './routes/person.routes.js';
import statsRoutes from './routes/stats.routes.js';
import errorHandler from './middleware/error.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static assets
app.use('/uploads', express.static(path.join(__dirname, '../data/uploads')));
app.use('/results', express.static(path.join(__dirname, '../data/results')));

// Routes
app.use('/api/video', videoRoutes);
app.use('/api/persons', personRoutes);
app.use('/api/stats', statsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend running', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ success: false, error: 'Not Found' });
});

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});
