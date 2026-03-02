const express = require("express");
const auth = require("../middleware/authMiddleware");
const {
  createQuiz,
  getAllQuizzes,
  getMyResults,
  getPerformanceStats,
  getQuizResultReview,
  getUserResultsByEmail,
  submitQuiz,
  updateQuiz,
  getQuizByIdAdmin,
  getQuizById,
  deleteQuiz,
} = require("../controllers/quizController");

const router = express.Router();

// Create a new quiz (Admin only)
router.post("/create", auth, createQuiz);

// get all quizzes without answers for students
router.get("/", getAllQuizzes);

// get current user's quiz results
router.get("/myresults", auth, getMyResults);

// get performance stats for heatmap and trend analysis
router.get("/performance/stats", auth, getPerformanceStats);

// get detailed quiz result review by result ID
router.get("/results/:resultId", auth, getQuizResultReview);

// get quiz results by user email (Admin only)
router.get("/results/user/:email", auth, getUserResultsByEmail);

// submit quiz answers and calculate result
router.post("/:id/submit", auth, submitQuiz);

// update quiz (Admin only)
router.put("/:id", auth, updateQuiz);

// get quiz by ID for admin (includes answers)
router.get("/admin/:id", auth, getQuizByIdAdmin);

// get quiz by ID for students (no answers)
router.get("/:id", getQuizById);

// delete quiz (Admin only)
router.delete("/:id", auth, deleteQuiz);

module.exports = router;
