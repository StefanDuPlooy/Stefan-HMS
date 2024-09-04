// backend/src/models/assignment.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AssignmentSchema = new Schema({
  title: {
    type: String,
    required: [true, 'Please add a title for the assignment'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please add a description for the assignment'],
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  course: {
    type: Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'Please specify the course for this assignment']
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please specify the user who created this assignment']
  },
  dueDate: {
    type: Date,
    required: [true, 'Please add a due date for the assignment']
  },
  totalPoints: {
    type: Number,
    required: [true, 'Please specify the total points for this assignment'],
    min: [0, 'Total points cannot be negative']
  },
  submissionType: {
    type: String,
    enum: ['video', 'document', 'link'],
    required: [true, 'Please specify the submission type for this assignment']
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'closed'],
    default: 'draft'
  },
  submissions: [{
    type: Schema.Types.ObjectId,
    ref: 'Submission'
  }],
  attachments: [{
    fileName: String,
    fileUrl: String,
    fileType: String
  }],
  rubric: {
    type: Schema.Types.ObjectId,
    ref: 'Rubric'
  },
  allowLateSubmissions: {
    type: Boolean,
    default: false
  },
  lateSubmissionDeadline: {
    type: Date
  },
  lateSubmissionPenalty: {
    type: Number,
    min: [0, 'Late submission penalty cannot be negative'],
    max: [100, 'Late submission penalty cannot exceed 100%']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for the number of submissions
AssignmentSchema.virtual('submissionCount').get(function() {
  return this.submissions.length;
});

// Virtual for whether the assignment is overdue
AssignmentSchema.virtual('isOverdue').get(function() {
  return new Date() > this.dueDate;
});

// Index for efficient querying
AssignmentSchema.index({ course: 1, dueDate: -1 });
AssignmentSchema.index({ createdBy: 1, status: 1 });

// Static method to get assignments with submission stats
AssignmentSchema.statics.getWithSubmissionStats = async function(courseId) {
  return this.aggregate([
    { $match: { course: mongoose.Types.ObjectId(courseId) } },
    {
      $lookup: {
        from: 'submissions',
        localField: '_id',
        foreignField: 'assignment',
        as: 'submissionDetails'
      }
    },
    {
      $project: {
        title: 1,
        dueDate: 1,
        totalPoints: 1,
        submissionCount: { $size: '$submissionDetails' },
        averageScore: {
          $avg: '$submissionDetails.score'
        }
      }
    }
  ]);
};

// Method to check if a user has submitted this assignment
AssignmentSchema.methods.hasUserSubmitted = async function(userId) {
  const Submission = mongoose.model('Submission');
  const submission = await Submission.findOne({
    assignment: this._id,
    student: userId
  });
  return !!submission;
};

// Pre-save hook to ensure lateSubmissionDeadline is after dueDate
AssignmentSchema.pre('save', function(next) {
  if (this.allowLateSubmissions && this.lateSubmissionDeadline) {
    if (this.lateSubmissionDeadline <= this.dueDate) {
      next(new Error('Late submission deadline must be after the due date'));
    }
  }
  next();
});

// Cascade delete submissions when an assignment is deleted
AssignmentSchema.pre('remove', async function(next) {
  const Submission = mongoose.model('Submission');
  await Submission.deleteMany({ assignment: this._id });
  next();
});

module.exports = mongoose.model('Assignment', AssignmentSchema);