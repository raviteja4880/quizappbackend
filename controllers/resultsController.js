const Result = require('../models/Result');

// Fetch all results for user
exports.getMyResults = async (req, res) => {
  try {
    const results = await Result.find({ userId: req.user._id })
      .populate('quizId', 'title')
      .sort({ submittedAt: -1 });

    const formatted = results.map((r) => ({
      resultId: r._id,
      quizId: r.quizId?._id,
      quizTitle: r.quizId?.title || 'Unknown Quiz',
      score: r.score,
      total: r.total,
      correctCount: r.correctCount,
      wrongCount: r.wrongCount,
      percentage: r.percentage,
      status: r.status,
      duration: r.duration,
      submittedAt: r.submittedAt,
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching results:', err);
    res.status(500).json({ message: 'Failed to fetch results' });
  }
};

// Fetch single result
exports.getResultById = async (req, res) => {
  try {
    const result = await Result.findById(req.params.id).populate('quizId');
    if (!result) return res.status(404).json({ message: 'Result not found' });
    res.json(result);
  } catch (err) {
    console.error('Error fetching result:', err);
    res.status(500).json({ message: 'Failed to fetch result' });
  }
};
