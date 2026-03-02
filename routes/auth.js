const express = require("express");
const { signup, login, getAllUsers, updateProfile } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
// ✅ Added authMiddleware and admin check
router.get('/all', authMiddleware, (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: Admins only' });
  }
  next();
}, getAllUsers);
router.put('/profile', authMiddleware, updateProfile);

module.exports = router;
