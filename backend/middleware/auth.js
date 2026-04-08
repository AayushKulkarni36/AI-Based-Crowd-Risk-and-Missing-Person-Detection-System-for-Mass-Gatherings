import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-dev-secret-key-change-in-production';
// Use 30 days in dev so tokens never expire during development sessions.
// In production the env variable should be set to '8h' or shorter.
const JWT_EXPIRY = process.env.JWT_EXPIRY || (process.env.NODE_ENV === 'production' ? '8h' : '30d');

/**
 * Middleware: Verify JWT token and attach user to request
 */
export function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (jwtErr) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * Middleware: Verify user is ADMIN
 */
export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    next();
  });
}

/**
 * Middleware factory: allow only selected roles
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }
      next();
    });
  };
}

/**
 * Generate JWT token for user
 */
export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

export default { requireAuth, requireAdmin, requireRole, generateToken };
