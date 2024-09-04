// backend/src/routes/videos.js

const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const videoController = require('../controllers/videoController');
const { auth, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { upload } = require('../middleware/upload');

// Validation rules
const createVideoRules = [
  check('title').notEmpty().withMessage('Title is required').isLength({ max: 100 }).withMessage('Title cannot exceed 100 characters'),
  check('description').optional().isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
  check('assignmentId').notEmpty().withMessage('Assignment ID is required').isMongoId().withMessage('Invalid Assignment ID')
];

const updateVideoRules = [
  check('title').optional().notEmpty().withMessage('Title cannot be empty').isLength({ max: 100 }).withMessage('Title cannot exceed 100 characters'),
  check('description').optional().isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters')
];

// Routes

// Upload video
router.post('/upload',
  auth,
  authorize('student'),
  upload.single('video'),
  validate(createVideoRules),
  videoController.uploadVideo
);

// Get all videos (admin only)
router.get('/',
  auth,
  authorize('admin'),
  videoController.getAllVideos
);

// Get video by ID
router.get('/:id',
  auth,
  videoController.getVideoById
);

// Update video details
router.put('/:id',
  auth,
  validate(updateVideoRules),
  videoController.updateVideo
);

// Delete video
router.delete('/:id',
  auth,
  videoController.deleteVideo
);

// Stream video
router.get('/:id/stream',
  auth,
  videoController.streamVideo
);

// Get user's videos
router.get('/user/me',
  auth,
  videoController.getUserVideos
);

// Add comment to video
router.post('/:id/comments',
  auth,
  [check('content').notEmpty().withMessage('Comment content is required')],
  validate,
  videoController.addComment
);

// Get video comments
router.get('/:id/comments',
  auth,
  videoController.getVideoComments
);

// Toggle like on video
router.post('/:id/toggle-like',
  auth,
  videoController.toggleLike
);

// Get video statistics
router.get('/:id/stats',
  auth,
  authorize('lecturer', 'admin'),
  videoController.getVideoStats
);

// Generate video thumbnail
router.post('/:id/generate-thumbnail',
  auth,
  authorize('lecturer', 'admin'),
  videoController.generateThumbnail
);

// Add captions to video
router.post('/:id/captions',
  auth,
  authorize('lecturer', 'admin'),
  upload.single('captionFile'),
  [check('language').notEmpty().withMessage('Caption language is required')],
  validate,
  videoController.addCaptions
);

// Get video captions
router.get('/:id/captions',
  auth,
  videoController.getVideoCaptions
);

// Search videos
router.get('/search',
  auth,
  videoController.searchVideos
);

// Get videos for a specific assignment
router.get('/assignment/:assignmentId',
  auth,
  authorize('lecturer', 'admin'),
  videoController.getVideosForAssignment
);

// Bulk operations (admin only)
router.post('/bulk/delete',
  auth,
  authorize('admin'),
  videoController.bulkDeleteVideos
);

module.exports = router;