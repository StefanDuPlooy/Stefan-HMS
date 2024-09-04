// backend/src/models/submission.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SubmissionSchema = new Schema({
  student: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please specify the student who made this submission']
  },
  assignment: {
    type: Schema.Types.ObjectId,
    ref: 'Assignment',
    required: [true, 'Please specify the assignment this submission is for']
  },
  submissionType: {
    type: String,
    enum: ['video', 'document', 'link'],
    required: [true, 'Please specify the type of submission']
  },
  content: {
    type: String,
    required: [true, 'Please provide the submission content (file path or URL)']
  },
  fileSize: {
    type: Number,
    required: function() { return this.submissionType !== 'link'; }
  },
  duration: {
    type: Number,
    required: function() { return this.submissionType === 'video'; }
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'graded', 'returned'],
    default: 'pending'
  },
  grade: {
    type: Number,
    min: [0, 'Grade cannot be negative']
  },
  feedback: {
    type: String
  },
  isLate: {
    type: Boolean,
    default: false
  },
  gradedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  gradedAt: {
    type: Date
  },
  comments: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    content: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  attachments: [{
    fileName: String,
    fileUrl: String,
    fileType: String,
    fileSize: Number
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for formatted grade
SubmissionSchema.virtual('formattedGrade').get(function() {
  if (this.grade === undefined) return 'Not graded';
  return `${this.grade.toFixed(2)}%`;
});

// Virtual for time taken to grade
SubmissionSchema.virtual('gradingTime').get(function() {
  if (!this.gradedAt || !this.submittedAt) return null;
  return (this.gradedAt - this.submittedAt) / (1000 * 60 * 60); // in hours
});

// Index for efficient querying
SubmissionSchema.index({ student: 1, assignment: 1 }, { unique: true });
SubmissionSchema.index({ assignment: 1, submittedAt: -1 });

// Static method to get submission statistics for an assignment
SubmissionSchema.statics.getSubmissionStats = async function(assignmentId) {
  return this.aggregate([
    { $match: { assignment: mongoose.Types.ObjectId(assignmentId) } },
    {
      $group: {
        _id: null,
        totalSubmissions: { $sum: 1 },
        avgGrade: { $avg: '$grade' },
        minGrade: { $min: '$grade' },
        maxGrade: { $max: '$grade' },
        lateSubmissions: {
          $sum: { $cond: ['$isLate', 1, 0] }
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalSubmissions: 1,
        avgGrade: { $round: ['$avgGrade', 2] },
        minGrade: 1,
        maxGrade: 1,
        lateSubmissions: 1,
        onTimeSubmissions: { $subtract: ['$totalSubmissions', '$lateSubmissions'] }
      }
    }
  ]);
};

// Method to add a comment to the submission
SubmissionSchema.methods.addComment = async function(userId, content) {
  this.comments.push({ user: userId, content });
  return this.save();
};

// Pre-save hook to check if submission is late
SubmissionSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('submittedAt')) {
    const Assignment = mongoose.model('Assignment');
    const assignment = await Assignment.findById(this.assignment);
    if (assignment) {
      this.isLate = this.submittedAt > assignment.dueDate;
    }
  }
  next();
});

// Post-save hook to update assignment's submission count
SubmissionSchema.post('save', async function() {
  const Assignment = mongoose.model('Assignment');
  await Assignment.findByIdAndUpdate(this.assignment, {
    $addToSet: { submissions: this._id }
  });
});

// Pre-remove hook to update assignment's submission count
SubmissionSchema.pre('remove', async function(next) {
  const Assignment = mongoose.model('Assignment');
  await Assignment.findByIdAndUpdate(this.assignment, {
    $pull: { submissions: this._id }
  });
  next();
});

module.exports = mongoose.model('Submission', SubmissionSchema);