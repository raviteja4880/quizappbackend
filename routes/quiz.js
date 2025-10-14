const express = require('express');
const Quiz = require('../models/Quiz');
const Result = require('../models/Result');
const User = require("../models/User"); 
const auth = require("../middleware/authMiddleware");

const router = express.Router();

// Create Quiz (Admin Only)
router.post('/create', auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }

    const { title, description, timeLimit, questions } = req.body;
    const quiz = await Quiz.create({ title, description, timeLimit, questions });
    res.status(201).json(quiz);
  } catch (err) {
    res.status(500).json({ message: 'Error creating quiz', error: err.message });
  }
});

// Get All Quizzes (Hide Correct Answers)
router.get('/', async (req, res) => {
  try {
    const quizzes = await Quiz.find().select('-questions.correctAnswer');
    res.json(quizzes);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching quizzes', error: err.message });
  }
});

// Get Current User's Results
router.get('/myresults', auth, async (req, res) => {
  try {
    const results = await Result.find({ userId: req.user._id })
      .populate("quizId", "title")
      .sort({ submittedAt: -1 });

    const formatted = results.map(r => ({
      resultId: r._id,
      quizTitle: r.quizId?.title || "Deleted Quiz",
      score: r.score,
      total: r.total,
      percentage: r.percentage,
      correctCount: r.correctCount,
      wrongCount: r.wrongCount,
      status: r.status,
      submittedAt: r.submittedAt,
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: "Error fetching results", error: err.message });
  }
});

// Get Single Quiz for Review by Result ID
router.get('/results/:resultId', auth, async (req, res) => {
  try {
    const result = await Result.findById(req.params.resultId)
      .populate("quizId", "title description timeLimit questions");

    if (!result) return res.status(404).json({ message: "Result not found" });

    const quiz = result.quizId;
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    res.json({
      _id: quiz._id,
      title: quiz.title,
      description: quiz.description,
      timeLimit: quiz.timeLimit,
      questions: quiz.questions.map((q, index) => ({
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        userAnswer: result.userAnswers?.[index] ?? null,
      })),
      result: {
        score: result.score,
        total: result.total,
        percentage: result.percentage,
        correctCount: result.correctCount,
        wrongCount: result.wrongCount,
        status: result.status,
        submittedAt: result.submittedAt,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching quiz by result', error: err.message });
  }
});

// Get results by user email (Admin Only)
router.get("/results/user/:email", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admins only" });
    }

    const { email } = req.params;
    const user = await User.findOne({ email });

    // If user doesn't exist
    if (!user) {
      return res.status(404).json({ message: "Invalid user" });
    }

    // Fetch results for existing user
    const results = await Result.find({ userId: user._id })
      .populate("quizId", "title")
      .sort({ submittedAt: -1 });

    // If no results but user exists
    if (results.length === 0) {
      return res.json([]); 
    }

    // ✅ Return formatted results
    res.json(
      results.map((r) => ({
        resultId: r._id,
        quizTitle: r.quizId?.title || "Deleted Quiz",
        score: r.score,
        total: r.total,
        percentage: r.percentage,
        status: r.status,
        submittedAt: r.submittedAt,
      }))
    );
  } catch (err) {
    console.error("Error fetching user results:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Submit Quiz
router.post('/:id/submit', auth, async (req, res) => {
  try {
    const quizId = req.params.id;
    const userId = req.user._id;
    const { answers } = req.body;

    if (!userId) return res.status(401).json({ message: 'Unauthorized: User ID missing' });
    if (!answers || !Array.isArray(answers)) return res.status(400).json({ message: 'Answers must be an array' });

    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    let score = 0, correctCount = 0, wrongCount = 0;
    const userAnswers = {};

    quiz.questions.forEach((q, index) => {
      const userAnswer = answers[index] ?? null;
      userAnswers[index] = userAnswer;

      if (userAnswer === q.correctAnswer) {
        score++;
        correctCount++;
      } else {
        wrongCount++;
      }
    });

    const percentage = (score / quiz.questions.length) * 100;

    const result = await Result.create({
      userId,
      quizId: quiz._id,
      score,
      total: quiz.questions.length,
      correctCount,
      wrongCount,
      percentage,
      status: "completed",
      userAnswers,
    });

    res.json({
      message: 'Quiz submitted successfully',
      score,
      total: quiz.questions.length,
      percentage,
      correctCount,
      wrongCount,
      resultId: result._id,
    });
  } catch (err) {
    console.error("Error submitting quiz:", err);
    res.status(500).json({ message: 'Error submitting quiz', error: err.message });
  }
});

// Update Quiz (Admin Only)
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }

    const { title, description, timeLimit, questions } = req.body;

    // Update and return updated quiz
    const updatedQuiz = await Quiz.findByIdAndUpdate(
      req.params.id,
      { title, description, timeLimit, questions },
      { new: true, runValidators: true }
    );

    if (!updatedQuiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    res.json({
      message: "Quiz updated successfully",
      quiz: updatedQuiz,
    });
  } catch (err) {
    console.error("Error updating quiz:", err);
    res.status(500).json({ message: "Error updating quiz", error: err.message });
  }
});

// Admin-only get quiz by ID
router.get("/admin/:id", auth, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden: Admins only" });
  }
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    res.json(quiz);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// Get Quiz by ID (Hide Answers)
router.get('/:id', async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id).select('-questions.correctAnswer');
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
    res.json(quiz);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching quiz', error: err.message });
  }
});

// Delete Quiz (Admin Only)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }

    const deletedQuiz = await Quiz.findByIdAndDelete(req.params.id);
    if (!deletedQuiz) return res.status(404).json({ message: 'Quiz not found' });

    res.json({ message: 'Quiz deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting quiz', error: err.message });
  }
});

module.exports = router;
