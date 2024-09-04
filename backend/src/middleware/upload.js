// backend/src/middlewares/upload.js

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { AppError } = require('./error');
const logger = require('../config/logger');

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    // Generate a unique filename
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure file filter
const fileFilter = (req, file, cb) => {
  // Accept video files only
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new AppError('Not a video file! Please upload only videos.', 400), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB
  }
});

// Middleware to handle file upload errors
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      logger.warn(`File size limit exceeded: ${err.message}`);
      return next(new AppError('File too large. Maximum file size is 100 MB.', 400));
    }
    logger.error(`Multer error: ${err.message}`);
    return next(new AppError(`File upload error: ${err.message}`, 400));
  }
  
  if (err) {
    logger.error(`File upload error: ${err.message}`);
    return next(err);
  }
  
  next();
};

// Middleware to check if file was uploaded
const checkFileExists = (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Please upload a file', 400));
  }
  next();
};

// Middleware to validate video duration
const validateVideoDuration = (maxDuration) => {
  return (req, res, next) => {
    if (!req.file) {
      return next(new AppError('No file uploaded', 400));
    }

    const ffprobe = require('ffprobe');
    const ffprobeStatic = require('ffprobe-static');

    ffprobe(req.file.path, { path: ffprobeStatic.path })
      .then(info => {
        const duration = info.streams[0].duration;
        if (duration > maxDuration) {
          // Delete the uploaded file
          require('fs').unlinkSync(req.file.path);
          return next(new AppError(`Video duration exceeds the maximum allowed duration of ${maxDuration} seconds`, 400));
        }
        req.file.duration = duration;
        next();
      })
      .catch(err => {
        logger.error(`Error validating video duration: ${err.message}`);
        next(new AppError('Error validating video file', 500));
      });
  };
};

module.exports = {
  upload,
  handleUploadError,
  checkFileExists,
  validateVideoDuration
};