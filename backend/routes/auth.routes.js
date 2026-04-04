import express from 'express';
import { login, signup, getMe, changePassword } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/auth/login
 * Login with email and password
 * Returns JWT token + user info
 */
router.post('/login', login);

/**
 * POST /api/auth/signup
 * Create new user account (users always get OPERATOR role)
 * Returns JWT token + user info
 */
router.post('/signup', signup);

/**
 * GET /api/auth/me
 * Get current user info from JWT
 * Requires: Authorization header with Bearer token
 */
router.get('/me', requireAuth, getMe);

/**
 * POST /api/auth/change-password
 * Change password for authenticated user
 * Requires: Authorization header with Bearer token
 */
router.post('/change-password', requireAuth, changePassword);

export default router;
