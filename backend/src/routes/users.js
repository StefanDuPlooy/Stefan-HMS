// backend/src/routes/users.js

const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const userController = require('../controllers/userController');
const { auth, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// Validation rules
const updateUserRules = [
  check('username').optional().isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters'),
  check('email').optional().isEmail().withMessage('Please include a valid email'),
  check('firstName').optional().isLength({ max: 50 }).withMessage('First name cannot exceed 50 characters'),
  check('lastName').optional().isLength({ max: 50 }).withMessage('Last name cannot exceed 50 characters'),
  check('bio').optional().isLength({ max: 500 }).withMessage('Bio cannot exceed 500 characters')
];

const createUserRules = [
  check('username').notEmpty().withMessage('Username is required').isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters'),
  check('email').notEmpty().withMessage('Email is required').isEmail().withMessage('Please include a valid email'),
  check('password').notEmpty().withMessage('Password is required').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  check('role').optional().isIn(['student', 'lecturer', 'admin']).withMessage('Invalid role')
];

// Routes

// Public routes
router.get('/public/:id', userController.getPublicProfile);

// Protected routes (require authentication)
router.use(auth);

router.get('/me', userController.getCurrentUser);
router.put('/me', validate(updateUserRules), userController.updateCurrentUser);
router.get('/me/courses', userController.getCurrentUserCourses);
router.get('/me/assignments', userController.getCurrentUserAssignments);

// Admin only routes
router.use(authorize('admin'));

router.route('/')
  .get(userController.getAllUsers)
  .post(validate(createUserRules), userController.createUser);

router.route('/:id')
  .get(userController.getUserById)
  .put(validate(updateUserRules), userController.updateUser)
  .delete(userController.deleteUser);

router.put('/:id/role', 
  [check('role').notEmpty().isIn(['student', 'lecturer', 'admin']).withMessage('Invalid role')],
  validate,
  userController.changeUserRole
);

router.get('/:id/activity', userController.getUserActivity);

// Bulk operations
router.post('/bulk/create', userController.bulkCreateUsers);
router.put('/bulk/update', userController.bulkUpdateUsers);
router.delete('/bulk/delete', userController.bulkDeleteUsers);

// User statistics
router.get('/stats/overview', userController.getUserStats);
router.get('/stats/roles', userController.getUserRoleStats);
router.get('/stats/activity', userController.getUserActivityStats);

// Search and filters
router.get('/search', userController.searchUsers);
router.get('/filter', userController.filterUsers);

module.exports = router;