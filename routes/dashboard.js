const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const auth = require("../middleware/authMiddleware");
const Result = require("../models/Result");

// GET /api/dashboard/student
router.get("/student", auth, async (req, res) => {
  try {
    // Allow only students
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Access denied: Students only" });
    }

    const userId = mongoose.Types.ObjectId(req.user._id);

    //  Aggregate summary stats
    const summaryAgg = await Result.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalQuizzes: { $sum: 1 },
          avgPercentage: { $avg: "$percentage" },
          bestPercentage: { $max: "$percentage" },
          worstPercentage: { $min: "$percentage" },
        },
      },
    ]);

    const summaryRaw = summaryAgg[0] || {};

    // Fetch best/worst quiz titles
    const bestQuiz = await Result.findOne({ userId })
      .sort({ percentage: -1 })
      .limit(1)
      .populate("quizId", "title")
      .lean();

    const worstQuiz = await Result.findOne({ userId })
      .sort({ percentage: 1 })
      .limit(1)
      .populate("quizId", "title")
      .lean();

    //  Aggregate trend (average percentage per day)
    const trendAgg = await Result.aggregate([
      { $match: { userId } },
      {
        $project: {
          percentage: 1,
          dateStr: { $dateToString: { format: "%Y-%m-%d", date: "$submittedAt" } },
        },
      },
      {
        $group: {
          _id: "$dateStr",
          avgPercentage: { $avg: "$percentage" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const trend = trendAgg.map((r) => ({
      date: r._id,
      percentage: Number(r.avgPercentage.toFixed(2)),
      count: r.count,
    }));

    //  Aggregate heatmap (quiz submissions per day)
    const heatAgg = await Result.aggregate([
      { $match: { userId } },
      {
        $project: {
          dateStr: { $dateToString: { format: "%Y-%m-%d", date: "$submittedAt" } },
        },
      },
      {
        $group: {
          _id: "$dateStr",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const heatmap = heatAgg.map((r) => ({ date: r._id, count: r.count }));

    //  Final summary object
    const summary = {
      totalQuizzes: summaryRaw.totalQuizzes || 0,
      avgPercentage: summaryRaw.avgPercentage
        ? Number(summaryRaw.avgPercentage.toFixed(2))
        : 0,
      bestQuiz: bestQuiz
        ? { quizTitle: bestQuiz.quizId?.title || "Unknown", percentage: bestQuiz.percentage }
        : null,
      worstQuiz: worstQuiz
        ? { quizTitle: worstQuiz.quizId?.title || "Unknown", percentage: worstQuiz.percentage }
        : null,
    };

    res.json({ heatmap, trend, summary });
  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).json({ message: "Error generating dashboard", error: err.message });
  }
});

module.exports = router;
