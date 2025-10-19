const express = require("express");
const Quiz = require("../models/Quiz");
const Result = require("../models/Result");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");

const router = express.Router();

/* -----------------------------
   🧩 ADMIN — CREATE QUIZ
----------------------------- */
router.post("/create", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }

    const { title, description, timeLimit, questions } = req.body;
    const quiz = await Quiz.create({ title, description, timeLimit, questions });

    res.status(201).json(quiz);
  } catch (err) {
    res.status(500).json({ message: "Error creating quiz", error: err.message });
  }
});

/* -----------------------------
   📋 GET ALL QUIZZES (No Answers)
----------------------------- */
router.get("/", async (req, res) => {
  try {
    const quizzes = await Quiz.find().select("-questions.correctAnswer");
    res.json(quizzes);
  } catch (err) {
    res.status(500).json({ message: "Error fetching quizzes", error: err.message });
  }
});

/* -----------------------------
   🧑‍🎓 GET CURRENT USER RESULTS
----------------------------- */
router.get("/myresults", auth, async (req, res) => {
  try {
    const results = await Result.find({ userId: req.user._id })
      .populate("quizId", "title")
      .sort({ submittedAt: -1 });

    const formatted = results.map((r) => ({
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

/* -----------------------------
   📊 STUDENT PERFORMANCE (HEATMAP + TREND)
----------------------------- */
router.get("/performance/stats", auth, async (req, res) => {
  try {
    const results = await Result.find({ userId: req.user._id });

    if (!results.length) {
      return res.json({
        dailyActivity: {},
        trend: [],
        avgPercentage: 0,
        totalQuizzes: 0,
      });
    }

    // Group by date for heatmap
    const dailyActivity = {};
    results.forEach((r) => {
      const date = r.submittedAt.toISOString().split("T")[0];
      dailyActivity[date] = (dailyActivity[date] || 0) + 1;
    });

    // Sort and map results for trend line
    const trend = results
      .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt))
      .map((r) => ({
        date: r.submittedAt.toISOString().split("T")[0],
        percentage: r.percentage,
      }));

    const avgPercentage =
      results.reduce((sum, r) => sum + r.percentage, 0) / results.length;

    res.json({
      dailyActivity,
      trend,
      avgPercentage: Number(avgPercentage.toFixed(2)),
      totalQuizzes: results.length,
    });
  } catch (err) {
    console.error("Error fetching performance stats:", err);
    res.status(500).json({ message: "Error fetching performance stats" });
  }
});

/* -----------------------------
   🧾 GET SINGLE QUIZ RESULT REVIEW
----------------------------- */
router.get("/results/:resultId", auth, async (req, res) => {
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
    res.status(500).json({
      message: "Error fetching quiz by result",
      error: err.message,
    });
  }
});

/* -----------------------------
   🧠 ADMIN — FETCH USER RESULTS BY EMAIL
----------------------------- */
router.get("/results/user/:email", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admins only" });
    }

    const { email } = req.params;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "Invalid user" });

    const results = await Result.find({ userId: user._id })
      .populate("quizId", "title")
      .sort({ submittedAt: -1 });

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

/* -----------------------------
   🧾 SUBMIT QUIZ
----------------------------- */
router.post("/:id/submit", auth, async (req, res) => {
  try {
    const { id: quizId } = req.params;
    const userId = req.user._id;
    const { answers } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ message: "Answers must be an array" });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    let score = 0,
      correctCount = 0,
      wrongCount = 0;
    const userAnswers = {};

    quiz.questions.forEach((q, i) => {
      const userAnswer = answers[i] ?? null;
      userAnswers[i] = userAnswer;

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
      quizId,
      score,
      total: quiz.questions.length,
      correctCount,
      wrongCount,
      percentage,
      status: "completed",
      userAnswers,
    });

    res.json({
      message: "Quiz submitted successfully",
      score,
      total: quiz.questions.length,
      percentage,
      correctCount,
      wrongCount,
      resultId: result._id,
    });
  } catch (err) {
    console.error("Error submitting quiz:", err);
    res.status(500).json({ message: "Error submitting quiz", error: err.message });
  }
});

/* -----------------------------
   🛠️ ADMIN — UPDATE QUIZ
----------------------------- */
router.put("/:id", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }

    const { title, description, timeLimit, questions } = req.body;

    const updatedQuiz = await Quiz.findByIdAndUpdate(
      req.params.id,
      { title, description, timeLimit, questions },
      { new: true, runValidators: true }
    );

    if (!updatedQuiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    res.json({ message: "Quiz updated successfully", quiz: updatedQuiz });
  } catch (err) {
    res.status(500).json({ message: "Error updating quiz", error: err.message });
  }
});

/* -----------------------------
   🧩 ADMIN — GET QUIZ BY ID
----------------------------- */
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

/* -----------------------------
   🧩 GET QUIZ BY ID (Student-safe)
----------------------------- */
router.get("/:id", async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id).select("-questions.correctAnswer");
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    res.json(quiz);
  } catch (err) {
    res.status(500).json({ message: "Error fetching quiz", error: err.message });
  }
});

/* -----------------------------
   🗑️ ADMIN — DELETE QUIZ
----------------------------- */
router.delete("/:id", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }

    const deletedQuiz = await Quiz.findByIdAndDelete(req.params.id);
    if (!deletedQuiz) return res.status(404).json({ message: "Quiz not found" });

    res.json({ message: "Quiz deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting quiz", error: err.message });
  }
});

module.exports = router;
