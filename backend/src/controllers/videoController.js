// backend/src/controllers/videoContoller.js

const Video = require('../models/video');
const Assignment = require('../models/assignment');
const Submission = require('../models/submission');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');
const { promisify } = require('util');
const ffmpeg = require('fluent-ffmpeg');

const unlinkAsync = promisify(fs.unlink);

// Helper function to get video duration
const getVideoDuration = (videoPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata.format.duration);
    });
  });
};

// Upload a video
exports.uploadVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No video file uploaded' });
    }

    const { title, description, assignmentId } = req.body;

    // Check if the assignment exists
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      await unlinkAsync(req.file.path);
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // Get video duration
    const duration = await getVideoDuration(req.file.path);

    const video = new Video({
      title,
      description,
      filePath: req.file.path,
      fileName: req.file.filename,
      fileSize: req.file.size,
      duration,
      uploadedBy: req.user.id,
      assignment: assignmentId
    });

    await video.save();

    // Create a submission for this video
    const submission = new Submission({
      assignment: assignmentId,
      student: req.user.id,
      video: video._id
    });

    await submission.save();

    logger.info(`New video uploaded: ${video._id}`);
    res.status(201).json(video);
  } catch (error) {
    logger.error(`Error uploading video: ${error.message}`);
    if (req.file) {
      await unlinkAsync(req.file.path);
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all videos (admin only)
exports.getAllVideos = async (req, res) => {
  try {
    const videos = await Video.find().populate('uploadedBy', 'username email');
    res.json(videos);
  } catch (error) {
    logger.error(`Error fetching all videos: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get video by ID
exports.getVideoById = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id).populate('uploadedBy', 'username email');
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Check if the user has permission to view this video
    if (video.uploadedBy._id.toString() !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'lecturer') {
      return res.status(403).json({ message: 'Not authorized to view this video' });
    }

    res.json(video);
  } catch (error) {
    logger.error(`Error fetching video by ID: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update video details
exports.updateVideo = async (req, res) => {
  try {
    const { title, description } = req.body;
    const video = await Video.findById(req.params.id);

    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    if (video.uploadedBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this video' });
    }

    video.title = title || video.title;
    video.description = description || video.description;

    await video.save();

    logger.info(`Video updated: ${video._id}`);
    res.json(video);
  } catch (error) {
    logger.error(`Error updating video: ${error.message}`);
    res.status(400).json({ message: 'Update failed', error: error.message });
  }
};

// Delete video
exports.deleteVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);

    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    if (video.uploadedBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this video' });
    }

    // Delete the video file
    await unlinkAsync(video.filePath);

    // Delete the video document
    await video.remove();

    // Delete associated submission
    await Submission.findOneAndDelete({ video: video._id });

    logger.info(`Video deleted: ${req.params.id}`);
    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    logger.error(`Error deleting video: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Stream video
exports.streamVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Check if the user has permission to stream this video
    if (video.uploadedBy.toString() !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'lecturer') {
      return res.status(403).json({ message: 'Not authorized to stream this video' });
    }

    const videoPath = video.filePath;
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize-1;
      const chunksize = (end-start)+1;
      const file = fs.createReadStream(videoPath, {start, end});
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(200, head);
      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (error) {
    logger.error(`Error streaming video: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get user's videos
exports.getUserVideos = async (req, res) => {
  try {
    const videos = await Video.find({ uploadedBy: req.user.id }).sort('-createdAt');
    res.json(videos);
  } catch (error) {
    logger.error(`Error fetching user videos: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};