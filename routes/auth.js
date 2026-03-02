const express = require("express");
const { signup, login, getAllUsers, updateProfile } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/all', getAllUsers);
router.put('/profile', authMiddleware, updateProfile);

module.exports = router;
