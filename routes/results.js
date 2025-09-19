const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Result = require('../models/Result');

router.get('/mine', auth, async (req, res) => {
  try {
    const results = await Result.find({ userId: req.user._id })
      .populate('quizId', 'title')
      .sort({ submittedAt: -1 });

    const formatted = results.map((r) => ({
      quizTitle: r.quizId?.title || "Unknown Quiz",
      score: r.score,
      total: r.total,
      submittedAt: r.submittedAt,
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch results' });
  }
});

module.exports = router;
