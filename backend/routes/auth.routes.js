import express from 'express';
import { login, register, getMe } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/auth/login
 * Login with email and password
 * Returns JWT token
 */
router.post('/login', login);

/**
 * POST /api/auth/register
 * Create new user account (disabled in production by default)
 */
router.post('/register', register);

/**
 * GET /api/auth/me
 * Get current user info from JWT
 */
router.get('/me', requireAuth, getMe);

export default router;
