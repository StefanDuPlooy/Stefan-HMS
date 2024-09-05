// backend/src/models/course.js

const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a course name'],
    unique: true,
    trim: true,
    maxlength: [50, 'Name can not be more than 50 characters']
  },
  description: {
    type: String,
    required: [true, 'Please add a description'],
    maxlength: [500, 'Description can not be more than 500 characters']
  },
  students: [{
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }],
  // Add other relevant fields
}, {
  timestamps: true
});

module.exports = mongoose.model('Course', CourseSchema);