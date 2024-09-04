// backend/src/models/video.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const VideoSchema = new Schema({
  title: {
    type: String,
    required: [true, 'Please add a title for the video'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  filePath: {
    type: String,
    required: [true, 'Please provide the file path for the video']
  },
  fileName: {
    type: String,
    required: [true, 'Please provide the file name']
  },
  fileSize: {
    type: Number,
    required: [true, 'Please provide the file size']
  },
  duration: {
    type: Number,
    required: [true, 'Please provide the duration of the video in seconds']
  },
  format: {
    type: String,
    required: [true, 'Please specify the video format']
  },
  resolution: {
    width: Number,
    height: Number
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please specify the user who uploaded this video']
  },
  assignment: {
    type: Schema.Types.ObjectId,
    ref: 'Assignment',
    required: [true, 'Please specify the assignment this video is for']
  },
  thumbnailPath: String,
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  processingMessage: String,
  isPublic: {
    type: Boolean,
    default: false
  },
  views: {
    type: Number,
    default: 0
  },
  likes: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    text: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  tags: [String],
  captions: [{
    language: String,
    filePath: String
  }],
  transcription: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for formatted duration
VideoSchema.virtual('formattedDuration').get(function() {
  const minutes = Math.floor(this.duration / 60);
  const seconds = this.duration % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// Virtual for like count
VideoSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

// Index for efficient querying
VideoSchema.index({ uploadedBy: 1, assignment: 1 });
VideoSchema.index({ title: 'text', description: 'text' });

// Static method to get video statistics
VideoSchema.statics.getVideoStats = async function(assignmentId) {
  return this.aggregate([
    { $match: { assignment: mongoose.Types.ObjectId(assignmentId) } },
    {
      $group: {
        _id: null,
        totalVideos: { $sum: 1 },
        avgDuration: { $avg: '$duration' },
        totalViews: { $sum: '$views' },
        avgFileSize: { $avg: '$fileSize' }
      }
    },
    {
      $project: {
        _id: 0,
        totalVideos: 1,
        avgDuration: { $round: ['$avgDuration', 2] },
        totalViews: 1,
        avgFileSize: { $round: [{ $divide: ['$avgFileSize', 1048576] }, 2] } // Convert to MB
      }
    }
  ]);
};

// Method to add a view to the video
VideoSchema.methods.addView = function() {
  this.views += 1;
  return this.save();
};

// Method to add a comment to the video
VideoSchema.methods.addComment = function(userId, text) {
  this.comments.push({ user: userId, text });
  return this.save();
};

// Method to toggle like on the video
VideoSchema.methods.toggleLike = function(userId) {
  const index = this.likes.indexOf(userId);
  if (index === -1) {
    this.likes.push(userId);
  } else {
    this.likes.splice(index, 1);
  }
  return this.save();
};

// Pre-remove hook to delete the video file
VideoSchema.pre('remove', async function(next) {
  const fs = require('fs').promises;
  try {
    await fs.unlink(this.filePath);
    if (this.thumbnailPath) {
      await fs.unlink(this.thumbnailPath);
    }
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Video', VideoSchema);