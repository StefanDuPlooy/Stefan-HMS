// backend/src/routes/assignments.js

const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const assignmentController = require('../controllers/assignmentController');
const { auth, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// Validation rules
const createAssignmentRules = [
  check('title').notEmpty().withMessage('Title is required'),
  check('description').notEmpty().withMessage('Description is required'),
  check('dueDate').isISO8601().toDate().withMessage('Valid due date is required'),
  check('totalPoints').isInt({ min: 0 }).withMessage('Total points must be a positive integer'),
  check('course').isMongoId().withMessage('Valid course ID is required')
];

const updateAssignmentRules = [
  check('title').optional().notEmpty().withMessage('Title cannot be empty'),
  check('description').optional().notEmpty().withMessage('Description cannot be empty'),
  check('dueDate').optional().isISO8601().toDate().withMessage('Valid due date is required'),
  check('totalPoints').optional().isInt({ min: 0 }).withMessage('Total points must be a positive integer')
];

// Routes
router.route('/')
  .get(auth, assignmentController.getAllAssignments)
  .post(auth, authorize('lecturer', 'admin'), validate(createAssignmentRules), assignmentController.createAssignment);

router.route('/:id')
  .get(auth, assignmentController.getAssignment)
  .put(auth, authorize('lecturer', 'admin'), validate(updateAssignmentRules), assignmentController.updateAssignment)
  .delete(auth, authorize('lecturer', 'admin'), assignmentController.deleteAssignment);

router.route('/:id/submit')
  .post(auth, authorize('student'), assignmentController.submitAssignment);

router.route('/:id/submissions')
  .get(auth, authorize('lecturer', 'admin'), assignmentController.getAssignmentSubmissions);

router.route('/submissions/:id/grade')
  .post(auth, authorize('lecturer', 'admin'), assignmentController.gradeSubmission);

router.route('/:id/stats')
  .get(auth, authorize('lecturer', 'admin'), assignmentController.getAssignmentStats);

router.route('/course/:courseId')
  .get(auth, assignmentController.getAssignmentsByCourse);

router.route('/:id/extend-deadline')
  .post(auth, authorize('lecturer', 'admin'), assignmentController.extendDeadline);

router.route('/:id/publish')
  .post(auth, authorize('lecturer', 'admin'), assignmentController.publishAssignment);

router.route('/:id/unpublish')
  .post(auth, authorize('lecturer', 'admin'), assignmentController.unpublishAssignment);

router.route('/:id/clone')
  .post(auth, authorize('lecturer', 'admin'), assignmentController.cloneAssignment);

module.exports = router;