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