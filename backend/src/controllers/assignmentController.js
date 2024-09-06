// backend/src/controllers/assignmentContoller.js

const Assignment = require('../models/assignment');
const Submission = require('../models/submission');
const { getCache, setCache, deleteCache } = require('../config/redis');
const logger = require('../config/logger');

// Create a new assignment
exports.createAssignment = async (req, res) => {
  try {
    const { title, description, dueDate, course } = req.body;
    const assignment = new Assignment({
      title,
      description,
      dueDate,
      course,
      createdBy: req.user.id
    });
    await assignment.save();
    await deleteCache('assignments'); // Invalidate assignments cache
    logger.info(`New assignment created: ${assignment._id}`);
    res.status(201).json(assignment);
  } catch (error) {
    logger.error(`Error creating assignment: ${error.message}`);
    res.status(400).json({ message: error.message });
  }
};

// Get all assignments
exports.getAllAssignments = async (req, res) => {
  try {
    const cachedAssignments = await getCache('assignments');
    if (cachedAssignments) {
      return res.json(JSON.parse(cachedAssignments));
    }
    
    const assignments = await Assignment.find().populate('course', 'name');
    await setCache('assignments', JSON.stringify(assignments), 3600); // Cache for 1 hour
    res.json(assignments);
  } catch (error) {
    logger.error(`Error fetching assignments: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

// Get a single assignment
exports.getAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id).populate('course', 'name');
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    res.json(assignment);
  } catch (error) {
    logger.error(`Error fetching assignment: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

// Update an assignment
exports.updateAssignment = async (req, res) => {
  try {
    const { title, description, dueDate, course } = req.body;
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    if (assignment.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this assignment' });
    }
    assignment.title = title || assignment.title;
    assignment.description = description || assignment.description;
    assignment.dueDate = dueDate || assignment.dueDate;
    assignment.course = course || assignment.course;
    await assignment.save();
    await deleteCache('assignments'); // Invalidate assignments cache
    logger.info(`Assignment updated: ${assignment._id}`);
    res.json(assignment);
  } catch (error) {
    logger.error(`Error updating assignment: ${error.message}`);
    res.status(400).json({ message: error.message });
  }
};

// Delete an assignment
exports.deleteAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    if (assignment.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this assignment' });
    }
    await assignment.remove();
    await deleteCache('assignments'); // Invalidate assignments cache
    logger.info(`Assignment deleted: ${req.params.id}`);
    res.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    logger.error(`Error deleting assignment: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

// Submit an assignment
exports.submitAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    if (new Date() > new Date(assignment.dueDate)) {
      return res.status(400).json({ message: 'Assignment submission deadline has passed' });
    }
    const submission = new Submission({
      assignment: assignment._id,
      student: req.user.id,
      video: req.body.videoId
    });
    await submission.save();
    assignment.submissions.push(submission._id);
    await assignment.save();
    logger.info(`New submission for assignment: ${assignment._id}, by student: ${req.user.id}`);
    res.status(201).json(submission);
  } catch (error) {
    logger.error(`Error submitting assignment: ${error.message}`);
    res.status(400).json({ message: error.message });
  }
};

// Grade a submission
exports.gradeSubmission = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }
    const assignment = await Assignment.findById(submission.assignment);
    if (assignment.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to grade this submission' });
    }
    submission.grade = req.body.grade;
    submission.feedback = req.body.feedback;
    await submission.save();
    logger.info(`Submission graded: ${submission._id}, grade: ${req.body.grade}`);
    res.json(submission);
  } catch (error) {
    logger.error(`Error grading submission: ${error.message}`);
    res.status(400).json({ message: error.message });
  }
};

// Get all submissions for an assignment
exports.getAssignmentSubmissions = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    if (assignment.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view these submissions' });
    }
    const submissions = await Submission.find({ assignment: req.params.id }).populate('student', 'username email');
    res.json(submissions);
  } catch (error) {
    logger.error(`Error fetching assignment submissions: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

exports.getAssignmentStats = async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const assignment = await Assignment.findById(assignmentId);
    
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    // Get all submissions for this assignment
    const submissions = await Submission.find({ assignment: assignmentId });

    // Calculate statistics
    const totalSubmissions = submissions.length;
    const gradedSubmissions = submissions.filter(sub => sub.grade !== undefined).length;
    const pendingSubmissions = totalSubmissions - gradedSubmissions;
    
    let averageGrade = 0;
    if (gradedSubmissions > 0) {
      const totalGrade = submissions.reduce((sum, sub) => sum + (sub.grade || 0), 0);
      averageGrade = totalGrade / gradedSubmissions;
    }

    const lateSubmissions = submissions.filter(sub => sub.isLate).length;

    // Get total number of students enrolled in the course
    const course = await User.countDocuments({ enrolledCourses: assignment.course });

    const submissionRate = (totalSubmissions / course) * 100;

    const stats = {
      totalSubmissions,
      gradedSubmissions,
      pendingSubmissions,
      averageGrade: averageGrade.toFixed(2),
      lateSubmissions,
      submissionRate: submissionRate.toFixed(2) + '%',
      totalStudents: course
    };

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error(`Error in getAssignmentStats: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.getAssignmentsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const assignments = await Assignment.find({ course: courseId })
      .populate('course', 'name')
      .sort('-createdAt');

    if (!assignments) {
      return res.status(404).json({ success: false, message: 'No assignments found for this course' });
    }

    res.status(200).json({
      success: true,
      count: assignments.length,
      data: assignments
    });
  } catch (error) {
    logger.error(`Error in getAssignmentsByCourse: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.extendDeadline = async (req, res) => {
  try {
    const { id } = req.params;
    const { newDeadline } = req.body;

    if (!newDeadline) {
      return res.status(400).json({ success: false, message: 'New deadline is required' });
    }

    const assignment = await Assignment.findById(id);

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    // Check if the new deadline is after the current deadline
    if (new Date(newDeadline) <= new Date(assignment.dueDate)) {
      return res.status(400).json({ success: false, message: 'New deadline must be after the current deadline' });
    }

    assignment.dueDate = newDeadline;
    await assignment.save();

    logger.info(`Deadline extended for assignment ${id} to ${newDeadline}`);

    res.status(200).json({
      success: true,
      data: assignment
    });
  } catch (error) {
    logger.error(`Error in extendDeadline: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.publishAssignment = async (req, res) => {
  try {
    const { id } = req.params;

    const assignment = await Assignment.findById(id);

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    if (assignment.status === 'published') {
      return res.status(400).json({ success: false, message: 'Assignment is already published' });
    }

    assignment.status = 'published';
    await assignment.save();

    logger.info(`Assignment ${id} has been published`);

    res.status(200).json({
      success: true,
      message: 'Assignment has been published successfully',
      data: assignment
    });
  } catch (error) {
    logger.error(`Error in publishAssignment: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.unpublishAssignment = async (req, res) => {
  try {
    const { id } = req.params;

    const assignment = await Assignment.findById(id);

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    if (assignment.status !== 'published') {
      return res.status(400).json({ success: false, message: 'Assignment is not currently published' });
    }

    assignment.status = 'draft';
    await assignment.save();

    logger.info(`Assignment ${id} has been unpublished`);

    res.status(200).json({
      success: true,
      message: 'Assignment has been unpublished successfully',
      data: assignment
    });
  } catch (error) {
    logger.error(`Error in unpublishAssignment: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.cloneAssignment = async (req, res) => {
  try {
    const { id } = req.params;

    const originalAssignment = await Assignment.findById(id);

    if (!originalAssignment) {
      return res.status(404).json({ success: false, message: 'Original assignment not found' });
    }

    // Create a new assignment object with properties from the original
    const newAssignment = new Assignment({
      title: `Copy of ${originalAssignment.title}`,
      description: originalAssignment.description,
      course: originalAssignment.course,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Set due date to one week from now
      totalPoints: originalAssignment.totalPoints,
      submissionType: originalAssignment.submissionType,
      createdBy: req.user.id,
      status: 'draft'
    });

    await newAssignment.save();

    logger.info(`Assignment ${id} has been cloned. New assignment ID: ${newAssignment._id}`);

    res.status(201).json({
      success: true,
      message: 'Assignment has been cloned successfully',
      data: newAssignment
    });
  } catch (error) {
    logger.error(`Error in cloneAssignment: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = exports;