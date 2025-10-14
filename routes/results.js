const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Result = require('../models/Result');
const Quiz = require('../models/Quiz'); // ✅ make sure this is imported

// Submit quiz
router.post('/:id/submit', auth, async (req, res) => {
  try {
    const quizId = req.params.id;
    const userId = req.user._id;
    const { answers, startedAt } = req.body;

    if (!userId) return res.status(401).json({ message: 'Unauthorized: User ID missing' });
    if (!answers || !Array.isArray(answers))
      return res.status(400).json({ message: 'Answers must be an array' });

    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    let score = 0,
      correctCount = 0,
      wrongCount = 0;

    //FIX: userAnswers is now stored as array (matching frontend)
    const userAnswers = answers;

    // FIX: score calculation based on index, not questionId
    quiz.questions.forEach((q, index) => {
      const userAnswer = answers[index];
      if (userAnswer === q.correctAnswer) {
        score++;
        correctCount++;
      } else {
        wrongCount++;
      }
    });

    const total = quiz.questions.length;
    const percentage = (score / total) * 100;
    const submittedAt = new Date();

    // Duration in minutes
    const duration = startedAt
      ? Math.floor((submittedAt - new Date(startedAt)) / 60000)
      : null;

    const result = await Result.create({
      userId,
      quizId,
      score,
      total,
      correctCount,
      wrongCount,
      percentage,
      status: 'completed',
      userAnswers, // ✅ now simple array (frontend matches)
      startedAt: startedAt ? new Date(startedAt) : undefined,
      submittedAt,
      duration,
    });

    res.json({
      message: 'Quiz submitted successfully',
      score,
      total,
      correctCount,
      wrongCount,
      percentage,
      duration,
      resultId: result._id,
    });
  } catch (err) {
    console.error('Error submitting quiz:', err);
    res.status(500).json({ message: 'Error submitting quiz', error: err.message });
  }
});

// Fetch all results for user
router.get('/mine', auth, async (req, res) => {
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
});

// Fetch single result
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await Result.findById(req.params.id).populate('quizId');
    if (!result) return res.status(404).json({ message: 'Result not found' });
    res.json(result);
  } catch (err) {
    console.error('Error fetching result:', err);
    res.status(500).json({ message: 'Failed to fetch result' });
  }
});

module.exports = router;
