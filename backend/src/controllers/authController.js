// backend/src/controllers/authController.js

const User = require('../models/user');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const logger = require('../config/logger');
const sendEmail = require('../utils/sendEmail');

// Helper function to generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// Register user
exports.register = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user
    user = new User({
      username,
      email,
      password,
      role: role || 'student' // Default role is student
    });

    // Generate email confirmation token
    const confirmationToken = user.generateEmailConfirmToken();

    await user.save();

    // Create confirmation URL
    const confirmationUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/confirmemail/${confirmationToken}`;

    // Send confirmation email
    try {
      await sendEmail({
        email: user.email,
        subject: 'Email Confirmation',
        message: `Please click on the following link to confirm your email: \n\n ${confirmationUrl}`
      });

      logger.info(`Confirmation email sent to: ${user.email}`);
    } catch (err) {
      logger.error(`Email send error: ${err.message}`);
      user.confirmEmailToken = undefined;
      await user.save({ validateBeforeSave: false });
      return res.status(500).json({ message: 'Email could not be sent' });
    }

    const token = generateToken(user._id);

    logger.info(`New user registered: ${user.email}`);
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    logger.error(`Registration error: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Confirm Email
exports.confirmEmail = async (req, res) => {
  try {
    // Get hashed token
    const confirmEmailToken = crypto
      .createHash('sha256')
      .update(req.params.confirmtoken)
      .digest('hex');

    const user = await User.findOne({
      confirmEmailToken,
      isEmailConfirmed: false
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // Set email as confirmed
    user.isEmailConfirmed = true;
    user.confirmEmailToken = undefined;
    await user.save({ validateBeforeSave: false });

    logger.info(`Email confirmed for user: ${user.email}`);
    res.status(200).json({ success: true, message: 'Email confirmed successfully' });
  } catch (error) {
    logger.error(`Email confirmation error: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id);

    logger.info(`User logged in: ${user.email}`);
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Logout user
exports.logout = (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000), // 10 seconds
    httpOnly: true
  });
  
  logger.info(`User logged out`);
  res.status(200).json({
    success: true,
    message: 'User logged out successfully'
  });
};

// Get current logged in user
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    logger.error(`Get user error: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update user details
exports.updateDetails = async (req, res) => {
  try {
    const fieldsToUpdate = {
      username: req.body.username,
      email: req.body.email
    };

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true
    });

    logger.info(`User updated details: ${user.email}`);
    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    logger.error(`Update user error: ${error.message}`);
    res.status(400).json({ message: 'Update failed', error: error.message });
  }
};

// Update password
exports.updatePassword = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    if (!(await user.matchPassword(req.body.currentPassword))) {
      return res.status(401).json({ message: 'Password is incorrect' });
    }

    user.password = req.body.newPassword;
    await user.save();

    const token = generateToken(user._id);

    logger.info(`User updated password: ${user.email}`);
    res.json({
      success: true,
      token
    });
  } catch (error) {
    logger.error(`Update password error: ${error.message}`);
    res.status(400).json({ message: 'Password update failed', error: error.message });
  }
};

// Forgot password
exports.forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res.status(404).json({ message: 'There is no user with that email' });
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();

    await user.save({ validateBeforeSave: false });

    // Create reset url
    const resetUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/resetpassword/${resetToken}`;

    const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Password reset token',
        message
      });

      logger.info(`Password reset email sent to: ${user.email}`);
      res.json({ success: true, data: 'Email sent' });
    } catch (err) {
      logger.error(`Email send error: ${err.message}`);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;

      await user.save({ validateBeforeSave: false });

      return res.status(500).json({ message: 'Email could not be sent' });
    }
  } catch (error) {
    logger.error(`Forgot password error: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Reset password
exports.resetPassword = async (req, res) => {
  try {
    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resettoken)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid token' });
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    const token = generateToken(user._id);

    logger.info(`User reset password: ${user.email}`);
    res.json({
      success: true,
      token
    });
  } catch (error) {
    logger.error(`Reset password error: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Add other functions (2FA, OAuth, etc.) as needed...

module.exports = exports;