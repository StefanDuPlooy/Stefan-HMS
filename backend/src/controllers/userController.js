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

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error(`Error in getCurrentUser: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Update current user
exports.updateCurrentUser = async (req, res) => {
  try {
    const fieldsToUpdate = {
      username: req.body.username,
      email: req.body.email,
      // Add any other fields that are allowed to be updated
    };

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true
    }).select('-password');

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error(`Error in updateCurrentUser: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get current user's courses
exports.getCurrentUserCourses = async (req, res) => {
  try {
    const courses = await Course.find({ students: req.user.id });
    res.status(200).json({
      success: true,
      data: courses
    });
  } catch (error) {
    logger.error(`Error in getCurrentUserCourses: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get current user's assignments
exports.getCurrentUserAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.find({ student: req.user.id });
    res.status(200).json({
      success: true,
      data: assignments
    });
  } catch (error) {
    logger.error(`Error in getCurrentUserAssignments: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Create a new user (admin only)
exports.createUser = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    const user = await User.create({
      username,
      email,
      password,
      role
    });

    res.status(201).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error(`Error in createUser: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Change user role (admin only)
exports.changeUserRole = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { role: req.body.role }, {
      new: true,
      runValidators: true
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error(`Error in changeUserRole: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get user activity
exports.getUserActivity = async (req, res) => {
  try {
    const submissions = await Submission.find({ student: req.params.id }).sort('-createdAt').limit(10);
    const assignments = await Assignment.find({ createdBy: req.params.id }).sort('-createdAt').limit(10);

    res.status(200).json({
      success: true,
      data: {
        recentSubmissions: submissions,
        recentAssignments: assignments
      }
    });
  } catch (error) {
    logger.error(`Error in getUserActivity: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Bulk create users
exports.bulkCreateUsers = async (req, res) => {
  try {
    const users = req.body.users;
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid input: users should be a non-empty array' });
    }

    const createdUsers = await User.insertMany(users, { rawResult: true });

    logger.info(`Bulk created ${createdUsers.insertedCount} users`);
    res.status(201).json({
      success: true,
      data: {
        insertedCount: createdUsers.insertedCount,
        users: createdUsers.ops
      }
    });
  } catch (error) {
    logger.error(`Error in bulkCreateUsers: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Bulk update users
exports.bulkUpdateUsers = async (req, res) => {
  try {
    const updates = req.body.updates;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid input: updates should be a non-empty array' });
    }

    const bulkOps = updates.map(update => ({
      updateOne: {
        filter: { _id: update.userId },
        update: { $set: update.data },
        upsert: false
      }
    }));

    const result = await User.bulkWrite(bulkOps);

    logger.info(`Bulk updated ${result.modifiedCount} users`);
    res.status(200).json({
      success: true,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        upsertedCount: result.upsertedCount
      }
    });
  } catch (error) {
    logger.error(`Error in bulkUpdateUsers: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Bulk delete users
exports.bulkDeleteUsers = async (req, res) => {
  try {
    const userIds = req.body.userIds;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid input: userIds should be a non-empty array' });
    }

    const result = await User.deleteMany({ _id: { $in: userIds } });

    // Delete associated data
    await Assignment.deleteMany({ createdBy: { $in: userIds } });
    await Submission.deleteMany({ student: { $in: userIds } });

    logger.info(`Bulk deleted ${result.deletedCount} users`);
    res.status(200).json({
      success: true,
      data: {
        deletedCount: result.deletedCount
      }
    });
  } catch (error) {
    logger.error(`Error in bulkDeleteUsers: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get stats on user roles
exports.getUserRoleStats = async (req, res) => {
  try {
    const roleCounts = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    const roleStats = roleCounts.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: roleStats
    });
  } catch (error) {
    logger.error(`Error in getUserRoleStats: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get user activity stats
exports.getUserActivityStats = async (req, res) => {
  try {
    const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const activeUsers = await User.countDocuments({ lastLogin: { $gte: lastMonth } });
    
    const submissionStats = await Submission.aggregate([
      { $match: { createdAt: { $gte: lastMonth } } },
      { $group: {
        _id: null,
        totalSubmissions: { $sum: 1 },
        uniqueStudents: { $addToSet: '$student' }
      } }
    ]);

    const assignmentStats = await Assignment.aggregate([
      { $match: { createdAt: { $gte: lastMonth } } },
      { $group: {
        _id: null,
        totalAssignments: { $sum: 1 },
        uniqueLecturers: { $addToSet: '$createdBy' }
      } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        activeUsersLastMonth: activeUsers,
        submissionsLastMonth: submissionStats[0]?.totalSubmissions || 0,
        uniqueStudentsSubmittedLastMonth: submissionStats[0]?.uniqueStudents.length || 0,
        assignmentsCreatedLastMonth: assignmentStats[0]?.totalAssignments || 0,
        uniqueLecturersCreatedAssignmentsLastMonth: assignmentStats[0]?.uniqueLecturers.length || 0
      }
    });
  } catch (error) {
    logger.error(`Error in getUserActivityStats: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Search users
exports.searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { firstName: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } }
      ]
    }).select('-password');

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    logger.error(`Error in searchUsers: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Filter users
exports.filterUsers = async (req, res) => {
  try {
    const { role, createdAt, lastLogin } = req.query;
    let query = {};

    if (role) {
      query.role = role;
    }

    if (createdAt) {
      const [start, end] = createdAt.split(',');
      query.createdAt = {};
      if (start) query.createdAt.$gte = new Date(start);
      if (end) query.createdAt.$lte = new Date(end);
    }

    if (lastLogin) {
      const [start, end] = lastLogin.split(',');
      query.lastLogin = {};
      if (start) query.lastLogin.$gte = new Date(start);
      if (end) query.lastLogin.$lte = new Date(end);
    }

    const users = await User.find(query).select('-password');

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    logger.error(`Error in filterUsers: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = exports;