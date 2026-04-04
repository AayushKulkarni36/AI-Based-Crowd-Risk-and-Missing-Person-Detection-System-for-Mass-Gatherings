import bcrypt from 'bcrypt';
import pool from '../config/db.js';
import { generateToken } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const BCRYPT_ROUNDS = 12;

// Helper: Validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Helper: Validate password strength (min 8 chars, at least 1 number + 1 letter)
function isValidPassword(password) {
  if (!password || password.length < 8) return false;
  return /[0-9]/.test(password) && /[a-zA-Z]/.test(password);
}

// Helper: Get password strength level
function getPasswordStrength(password) {
  if (!password || password.length < 8) return 'weak';
  if (password.length >= 12 && /[0-9]/.test(password) && /[a-zA-Z]/.test(password)) return 'strong';
  return 'fair';
}

/**
 * LOGIN - POST /api/auth/login
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password required'
      });
    }

    // Fetch user from database
    const result = await pool.query(
      'SELECT id, email, password_hash, role, full_name FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (result.rows.length === 0) {
      logger.warn(`Login attempt for non-existent user: ${email}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    const user = result.rows[0];

    // Verify password using bcrypt
    let passwordMatch = false;
    try {
      passwordMatch = await bcrypt.compare(password, user.password_hash);
    } catch (err) {
      logger.error(`bcrypt compare error for ${email}:`, err);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    if (!passwordMatch) {
      logger.warn(`Failed login attempt for user: ${email}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Update last_login timestamp
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    // Generate JWT
    const token = generateToken(user);

    logger.info(`User ${email} (${user.role}) logged in successfully`);

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    logger.error('Login failed:', error);
    return next(error);
  }
}

/**
 * SIGNUP - POST /api/auth/signup
 */
export async function signup(req, res, next) {
  try {
    const { full_name, email, password, confirmPassword } = req.body;

    // Validate inputs
    if (!full_name || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    if (full_name.length < 2 || full_name.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Full name must be between 2 and 100 characters'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters with a number and letter'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Passwords do not match'
      });
    }

    // Check if user already exists
    const existing = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email already exists'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Insert user (always OPERATOR role)
    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active, created_at)
       VALUES ($1, $2, $3, 'OPERATOR', true, NOW())
       RETURNING id, email, full_name, role`,
      [full_name, email, passwordHash]
    );

    const user = result.rows[0];

    // Generate JWT
    const token = generateToken(user);

    logger.info(`New user registered: ${email} (OPERATOR)`);

    return res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    logger.error('Signup failed:', error);
    return next(error);
  }
}

/**
 * GET CURRENT USER - GET /api/auth/me
 */
export async function getMe(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT id, email, full_name, role, created_at, last_login FROM users WHERE id = $1 AND is_active = true',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    return res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    logger.error('Get user failed:', error);
    return next(error);
  }
}

/**
 * CHANGE PASSWORD - POST /api/auth/change-password
 */
export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    if (!isValidPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters with a number and letter'
      });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        success: false,
        error: 'New passwords do not match'
      });
    }

    // Fetch current user
    const result = await pool.query(
      'SELECT id, password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = result.rows[0];

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, req.user.id]
    );

    logger.info(`Password changed for user: ${req.user.email}`);

    return res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Change password failed:', error);
    return next(error);
  }
}

export default { login, signup, getMe, changePassword };
