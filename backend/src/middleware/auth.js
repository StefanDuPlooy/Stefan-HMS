// backend/src/middleware/auth.js

const jwt = require('jsonwebtoken');
const User = require('../models/user');
const logger = require('../config/logger');

/**
 * Middleware to authenticate user using JWT token
 */
const auth = async (req, res, next) => {
  try {
    let token;

    // Check if token is in the Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } 
    // Check if token is in the cookie (for web clients)
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      logger.warn('No authentication token provided');
      return res.status(401).json({ message: 'Not authorized to access this route' });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if user still exists
      const user = await User.findById(decoded.id);
      if (!user) {
        logger.warn(`User not found for token: ${token}`);
        return res.status(401).json({ message: 'User no longer exists' });
      }

      // Check if user changed password after the token was issued
      if (user.changedPasswordAfter(decoded.iat)) {
        logger.warn(`User changed password after token was issued: ${user._id}`);
        return res.status(401).json({ message: 'User recently changed password. Please log in again' });
      }

      // Add user to request object
      req.user = user;
      next();
    } catch (error) {
      logger.error(`JWT verification failed: ${error.message}`);
      return res.status(401).json({ message: 'Not authorized to access this route' });
    }
  } catch (error) {
    logger.error(`Auth middleware error: ${error.message}`);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Middleware to restrict access to specific roles
 * @param {...string} roles - Roles allowed to access the route
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      logger.warn(`User ${req.user._id} attempted to access unauthorized route`);
      return res.status(403).json({ message: `User role ${req.user.role} is not authorized to access this route` });
    }
    next();
  };
};

module.exports = { auth, authorize }; 