// backend/src/controllers/userContoller.js

const User = require('../models/user');
const Assignment = require('../models/assignment');
const Submission = require('../models/submission');
const logger = require('../config/logger');

// Get all users (admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    logger.error(`Error fetching all users: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    logger.error(`Error fetching user by ID: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update user (admin only)
exports.updateUser = async (req, res) => {
  try {
    const { username, email, role } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { username, email, role },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    logger.info(`User updated by admin: ${user.email}`);
    res.json(user);
  } catch (error) {
    logger.error(`Error updating user: ${error.message}`);
    res.status(400).json({ message: 'Update failed', error: error.message });
  }
};

// Delete user (admin only)
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove user's assignments
    await Assignment.deleteMany({ createdBy: user._id });

    // Remove user's submissions
    await Submission.deleteMany({ student: user._id });

    await user.remove();

    logger.info(`User deleted: ${user.email}`);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error(`Error deleting user: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get user's profile
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    logger.error(`Error fetching user profile: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update user's own profile
exports.updateOwnProfile = async (req, res) => {
  try {
    const { username, email } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { username, email },
      { new: true, runValidators: true }
    ).select('-password');

    logger.info(`User updated own profile: ${user.email}`);
    res.json(user);
  } catch (error) {
    logger.error(`Error updating own profile: ${error.message}`);
    res.status(400).json({ message: 'Update failed', error: error.message });
  }
};

// Get user's assignments (for students)
exports.getUserAssignments = async (req, res) => {
  try {
    const submissions = await Submission.find({ student: req.user.id })
      .populate('assignment')
      .sort('-createdAt');

    const assignments = submissions.map(submission => ({
      ...submission.assignment.toObject(),
      submissionId: submission._id,
      submissionDate: submission.createdAt,
      grade: submission.grade,
      feedback: submission.feedback
    }));

    res.json(assignments);
  } catch (error) {
    logger.error(`Error fetching user assignments: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get user's created assignments (for lecturers)
exports.getUserCreatedAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.find({ createdBy: req.user.id })
      .sort('-createdAt');
    res.json(assignments);
  } catch (error) {
    logger.error(`Error fetching user created assignments: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get user statistics
exports.getUserStats = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let stats = {};

    if (user.role === 'student') {
      const submissions = await Submission.find({ student: user._id });
      const completedAssignments = submissions.length;
      const averageGrade = submissions.reduce((acc, curr) => acc + (curr.grade || 0), 0) / completedAssignments || 0;

      stats = {
        completedAssignments,
        averageGrade: averageGrade.toFixed(2)
      };
    } else if (user.role === 'lecturer') {
      const createdAssignments = await Assignment.countDocuments({ createdBy: user._id });
      const submissions = await Submission.find().populate('assignment');
      const gradedSubmissions = submissions.filter(sub => sub.assignment.createdBy.equals(user._id) && sub.grade != null).length;

      stats = {
        createdAssignments,
        gradedSubmissions
      };
    }

    res.json(stats);
  } catch (error) {
    logger.error(`Error fetching user stats: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get public profile of a user
exports.getPublicProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -email');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        username: user.username,
        role: user.role,
        // Add any other public fields you want to expose
      }
    });
  } catch (error) {
    logger.error(`Error in getPublicProfile: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = exports;