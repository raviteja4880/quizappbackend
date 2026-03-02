const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { getMyResults, getResultById } = require('../controllers/resultsController');

router.get('/mine', auth, getMyResults);
router.get('/:id', auth, getResultById);

module.exports = router;
