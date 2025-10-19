const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const auth = require("../middleware/authMiddleware");
const Result = require("../models/Result");

router.get("/student", auth, async (req, res) => {
  try {
    if (req.user.role !== "user") {
      return res.status(403).json({ message: "Access denied: Students only" });
    }

    const userId = new mongoose.Types.ObjectId(req.user._id);
    const totalResults = await Result.countDocuments({});
    const userResultsCount = await Result.countDocuments({ userId });

    if (userResultsCount === 0) {
      return res.json({
        message: "No quiz results found for this student.",
        heatmap: [],
        trend: [],
        summary: {
          totalQuizzes: 0,
          avgPercentage: 0,
          bestQuiz: null,
          worstQuiz: null,
        },
      });
    }

    // Summary Aggregation
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

    // Best & Worst Quizzes
    const bestQuiz = await Result.findOne({ userId })
      .sort({ percentage: -1 })
      .populate("quizId", "title")
      .lean();

    const worstQuiz = await Result.findOne({ userId })
      .sort({ percentage: 1 })
      .populate("quizId", "title")
      .lean();

    // Trend (average per day)
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

    // Heatmap (submissions per day)
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

    const heatmap = heatAgg.map((r) => ({
      date: r._id,
      count: r.count,
    }));

    // Final Summary Object
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

    // Response
    res.json({ heatmap, trend, summary });
  } catch (err) {
    console.error("❌ Dashboard Error:", err);
    res.status(500).json({ message: "Error generating dashboard", error: err.message });
  }
});

module.exports = router;
