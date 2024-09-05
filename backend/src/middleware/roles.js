// backend/src/middleware/roles.js

const { AppError } = require('./error');
const logger = require('../config/logger');

/**
 * Middleware to restrict access to specific roles
 * @param {...string} roles - Roles allowed to access the route
 */
const restrictTo = (...allowedRoles) => {
  return (req, res, next) => {
    // Check if user exists and has a role
    if (!req.user || !req.user.role) {
      logger.warn('User without role attempted to access restricted route');
      return next(new AppError('You do not have permission to perform this action', 403));
    }

    // Check if user's role is in the list of allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`User with role ${req.user.role} attempted to access restricted route`);
      return next(new AppError('You do not have permission to perform this action', 403));
    }

    next();
  };
};

/**
 * Middleware to ensure user can only access or modify their own resources
 * @param {string} userIdPath - Path to the user ID in the request object (e.g., 'params.userId', 'body.userId')
 */
const restrictToSelf = (userIdPath) => {
  return (req, res, next) => {
    const resourceUserId = userIdPath.split('.').reduce((obj, i) => obj[i], req);

    if (!resourceUserId) {
      return next(new AppError('User ID not found in request', 400));
    }

    if (req.user.role === 'admin') {
      // Admins can access all resources
      return next();
    }

    if (req.user.id !== resourceUserId) {
      logger.warn(`User ${req.user.id} attempted to access/modify resource of user ${resourceUserId}`);
      return next(new AppError('You can only access or modify your own resources', 403));
    }

    next();
  };
};

/**
 * Middleware to check if user has required permissions
 * @param {string[]} requiredPermissions - Array of required permissions
 */
const checkPermissions = (requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions) {
      logger.warn('User without permissions attempted to access restricted route');
      return next(new AppError('You do not have permission to perform this action', 403));
    }

    const hasAllPermissions = requiredPermissions.every(permission => 
      req.user.permissions.includes(permission)
    );

    if (!hasAllPermissions) {
      logger.warn(`User ${req.user.id} lacks required permissions for this action`);
      return next(new AppError('You do not have the required permissions to perform this action', 403));
    }

    next();
  };
};

module.exports = {
  restrictTo,
  restrictToSelf,
  checkPermissions
};