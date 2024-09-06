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

exports.generateThumbnail = async (req, res) => {
  try {
    const { id } = req.params;

    const video = await Video.findById(id);

    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    // In a real implementation, we would use ffmpeg here to generate the thumbnail
    // For this example, we'll simulate thumbnail generation

    const thumbnailPath = path.join(__dirname, '..', '..', 'uploads', `thumbnail_${video._id}.jpg`);
    
    // Simulate thumbnail generation
    await fs.writeFile(thumbnailPath, 'Simulated thumbnail data');

    video.thumbnailPath = thumbnailPath;
    await video.save();

    logger.info(`Thumbnail generated for video ${id}`);

    res.status(200).json({
      success: true,
      message: 'Thumbnail has been generated successfully',
      data: { thumbnailPath: video.thumbnailPath }
    });
  } catch (error) {
    logger.error(`Error in generateThumbnail: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Add comment to video
exports.addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    const video = await Video.findById(id);
    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    const comment = {
      user: userId,
      content,
      createdAt: new Date()
    };

    video.comments.push(comment);
    await video.save();

    logger.info(`Comment added to video ${id} by user ${userId}`);

    res.status(201).json({
      success: true,
      data: comment
    });
  } catch (error) {
    logger.error(`Error in addComment: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get video comments
exports.getVideoComments = async (req, res) => {
  try {
    const { id } = req.params;

    const video = await Video.findById(id).populate({
      path: 'comments.user',
      select: 'username'
    });

    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    const comments = video.comments.map(comment => ({
      id: comment._id,
      content: comment.content,
      createdAt: comment.createdAt,
      user: {
        id: comment.user._id,
        username: comment.user.username
      }
    }));

    res.status(200).json({
      success: true,
      count: comments.length,
      data: comments
    });
  } catch (error) {
    logger.error(`Error in getVideoComments: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.toggleLike = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const video = await Video.findById(id);

    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    const userLikedIndex = video.likes.indexOf(userId);

    if (userLikedIndex === -1) {
      // User hasn't liked the video, so add the like
      video.likes.push(userId);
    } else {
      // User has already liked the video, so remove the like
      video.likes.splice(userLikedIndex, 1);
    }

    await video.save();

    const action = userLikedIndex === -1 ? 'liked' : 'unliked';
    logger.info(`User ${userId} ${action} video ${id}`);

    res.status(200).json({
      success: true,
      message: `Video ${action} successfully`,
      data: {
        likes: video.likes.length,
        isLiked: userLikedIndex === -1
      }
    });
  } catch (error) {
    logger.error(`Error in toggleLike: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.getVideoStats = async (req, res) => {
  try {
    const { id } = req.params;

    const video = await Video.findById(id);

    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    const submissions = await Submission.find({ video: id });

    const stats = {
      views: video.views,
      likes: video.likes.length,
      comments: video.comments.length,
      submissionCount: submissions.length,
      averageGrade: 0
    };

    if (submissions.length > 0) {
      const totalGrade = submissions.reduce((sum, sub) => sum + (sub.grade || 0), 0);
      stats.averageGrade = (totalGrade / submissions.length).toFixed(2);
    }

    logger.info(`Video statistics retrieved for video ${id}`);

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error(`Error in getVideoStats: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.addCaptions = async (req, res) => {
  try {
    const { id } = req.params;
    const { language } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No caption file uploaded' });
    }

    const video = await Video.findById(id);

    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    const captionFileName = `caption_${id}_${language}${path.extname(req.file.originalname)}`;
    const captionFilePath = path.join(__dirname, '..', '..', 'uploads', captionFileName);

    // Move the uploaded file to the desired location
    await fs.rename(req.file.path, captionFilePath);

    // Add or update the caption for the specified language
    const captionIndex = video.captions.findIndex(caption => caption.language === language);
    if (captionIndex !== -1) {
      video.captions[captionIndex].filePath = captionFilePath;
    } else {
      video.captions.push({ language, filePath: captionFilePath });
    }

    await video.save();

    logger.info(`Captions added for video ${id} in language ${language}`);

    res.status(200).json({
      success: true,
      message: 'Captions added successfully',
      data: {
        language,
        filePath: captionFilePath
      }
    });
  } catch (error) {
    logger.error(`Error in addCaptions: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.getVideoCaptions = async (req, res) => {
  try {
    const { id } = req.params;

    const video = await Video.findById(id);

    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    const captions = video.captions.map(caption => ({
      language: caption.language,
      url: `/api/v1/videos/${id}/captions/${caption.language}` // Assuming you'll implement a route to serve caption files
    }));

    logger.info(`Captions retrieved for video ${id}`);

    res.status(200).json({
      success: true,
      data: captions
    });
  } catch (error) {
    logger.error(`Error in getVideoCaptions: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.searchVideos = async (req, res) => {
  try {
    const { query, page = 1, limit = 10 } = req.query;

    if (!query) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { createdAt: -1 },
      populate: { path: 'uploadedBy', select: 'username' }
    };

    const searchCriteria = {
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ]
    };

    const result = await Video.paginate(searchCriteria, options);

    const videos = result.docs.map(video => ({
      id: video._id,
      title: video.title,
      description: video.description,
      uploadedBy: video.uploadedBy.username,
      createdAt: video.createdAt,
      views: video.views,
      likes: video.likes.length
    }));

    logger.info(`Search performed for query: ${query}`);

    res.status(200).json({
      success: true,
      data: videos,
      currentPage: result.page,
      totalPages: result.totalPages,
      totalResults: result.totalDocs
    });
  } catch (error) {
    logger.error(`Error in searchVideos: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.getVideosForAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { createdAt: -1 },
      populate: { path: 'uploadedBy', select: 'username' }
    };

    const result = await Video.paginate({ assignment: assignmentId }, options);

    const videos = result.docs.map(video => ({
      id: video._id,
      title: video.title,
      description: video.description,
      uploadedBy: video.uploadedBy.username,
      createdAt: video.createdAt,
      views: video.views,
      likes: video.likes.length
    }));

    logger.info(`Retrieved videos for assignment: ${assignmentId}`);

    res.status(200).json({
      success: true,
      data: videos,
      currentPage: result.page,
      totalPages: result.totalPages,
      totalResults: result.totalDocs
    });
  } catch (error) {
    logger.error(`Error in getVideosForAssignment: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.bulkDeleteVideos = async (req, res) => {
  try {
    const { videoIds } = req.body;

    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or empty video ID list' });
    }

    const videos = await Video.find({ _id: { $in: videoIds } });

    if (videos.length !== videoIds.length) {
      return res.status(400).json({ success: false, message: 'One or more video IDs are invalid' });
    }

    // Delete video files
    for (const video of videos) {
      if (video.filePath) {
        try {
          await fs.unlink(path.join(__dirname, '..', '..', video.filePath));
        } catch (error) {
          logger.warn(`Failed to delete video file for ${video._id}: ${error.message}`);
        }
      }
      if (video.thumbnailPath) {
        try {
          await fs.unlink(path.join(__dirname, '..', '..', video.thumbnailPath));
        } catch (error) {
          logger.warn(`Failed to delete thumbnail for ${video._id}: ${error.message}`);
        }
      }
    }

    // Delete video documents
    await Video.deleteMany({ _id: { $in: videoIds } });

    // Delete associated submissions
    await Submission.deleteMany({ video: { $in: videoIds } });

    logger.info(`Bulk deleted ${videoIds.length} videos`);

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${videoIds.length} videos`,
      deletedCount: videoIds.length
    });
  } catch (error) {
    logger.error(`Error in bulkDeleteVideos: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = exports;