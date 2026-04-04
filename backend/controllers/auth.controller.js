import bcrypt from 'bcrypt';
import pool from '../config/db.js';
import { generateToken } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const BCRYPT_ROUNDS = 10;
const ALLOW_REGISTRATION = process.env.ALLOW_REGISTRATION === 'true';

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
      'SELECT id, email, password_hash, role, name FROM users WHERE email = $1 AND is_active = true',
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

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
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

    logger.info(`User ${email} logged in successfully`);

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    });
  } catch (error) {
    logger.error('Login failed:', error);
    return next(error);
  }
}

export async function register(req, res, next) {
  try {
    if (!ALLOW_REGISTRATION) {
      return res.status(403).json({
        success: false,
        error: 'Registration disabled. Contact administrator.'
      });
    }

    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, and name required'
      });
    }

    // Check if user already exists
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'User already exists'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Insert user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, email, name, role`,
      [email, passwordHash, name, 'OPERATOR']
    );

    const user = result.rows[0];

    // Generate JWT
    const token = generateToken(user);

    logger.info(`New user registered: ${email}`);

    return res.status(201).json({
      success: true,
      user,
      token
    });
  } catch (error) {
    logger.error('Registration failed:', error);
    return next(error);
  }
}

export async function getMe(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT id, email, name, role, last_login FROM users WHERE id = $1',
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

export default { login, register, getMe };
