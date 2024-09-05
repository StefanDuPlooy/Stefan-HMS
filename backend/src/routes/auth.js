// backend/src/routes/auth.js

const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// Validation rules
const registerRules = [
  check('username').notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters'),
  check('email').notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please include a valid email'),
  check('password').notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
    .matches(/\d/).withMessage('Password must contain a number')
];

const loginRules = [
  check('email').notEmpty().withMessage('Email is required').isEmail().withMessage('Please include a valid email'),
  check('password').notEmpty().withMessage('Password is required')
];

const updatePasswordRules = [
  check('currentPassword').notEmpty().withMessage('Current password is required'),
  check('newPassword').notEmpty().withMessage('New password is required')
    .isLength({ min: 6 }).withMessage('New password must be at least 6 characters long')
    .matches(/\d/).withMessage('New password must contain a number')
];

const forgotPasswordRules = [
  check('email').notEmpty().withMessage('Email is required').isEmail().withMessage('Please include a valid email')
];

const resetPasswordRules = [
  check('token').notEmpty().withMessage('Token is required'),
  check('password').notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
    .matches(/\d/).withMessage('Password must contain a number')
];

// Routes
router.post('/register', validate(registerRules), authController.register);
router.post('/login', validate(loginRules), authController.login);
router.get('/logout', auth, authController.logout);
router.get('/me', auth, authController.getMe);
router.put('/updatedetails', auth, authController.updateDetails);
router.put('/updatepassword', auth, validate(updatePasswordRules), authController.updatePassword);
router.post('/forgotpassword', validate(forgotPasswordRules), authController.forgotPassword);
router.put('/resetpassword/:resettoken', validate(resetPasswordRules), authController.resetPassword);
router.get('/confirmemail/:confirmtoken', authController.confirmEmail);

// Two-Factor Authentication routes
router.post('/2fa/generate', auth, authController.generate2FA);
router.post('/2fa/verify', auth, authController.verify2FA);
router.post('/2fa/disable', auth, authController.disable2FA);

// OAuth routes
// router.get('/google', authController.googleAuth);
// router.get('/google/callback', authController.googleAuthCallback);

// router.get('/facebook', authController.facebookAuth);
// router.get('/facebook/callback', authController.facebookAuthCallback);

// Account management
router.delete('/deleteaccount', auth, authController.deleteAccount);
router.post('/requestdataexport', auth, authController.requestDataExport);

// Session management
router.get('/sessions', auth, authController.getSessions);
router.post('/sessions/revoke', auth, authController.revokeSession);
router.post('/sessions/revokeall', auth, authController.revokeAllSessions);


module.exports = router;