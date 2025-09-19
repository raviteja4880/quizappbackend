const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
  },
  options: {
    type: [String], // array of option strings
    required: true,
    validate: [arrayLimit, '{PATH} must have at least 2 options'],
  },
  correctAnswer: {
    type: Number, // index of the correct option in options array
    required: true,
  },
});

function arrayLimit(val) {
  return val.length >= 2;
}

const quizSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    timeLimit: {
      type: Number, // in minutes
      required: true,
    },
    questions: [questionSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

module.exports = mongoose.model('Quiz', quizSchema);
