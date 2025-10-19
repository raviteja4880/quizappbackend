const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader) {
      return res.status(401).json({ message: 'Access Denied: No token provided' });
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : authHeader;

    if (!token) {
      return res.status(401).json({ message: 'Access Denied: Invalid token format' });
    }

    const verified = jwt.verify(token, process.env.JWT_SECRET);

    if (!verified._id) {
      return res.status(401).json({ message: 'Invalid Token: Missing user ID' });
    }

    // Fetch user from DB
    const user = await User.findById(verified._id).select('-password');
    if (!user) return res.status(401).json({ message: 'User not found' });

    // ✅ Assign the DB user to req.user
    req.user = user;

    next();
  } catch (err) {
    console.error('Auth Middleware Error:', err.message);
    res.status(401).json({ message: 'Invalid Token', error: err.message });
  }
};

module.exports = authMiddleware;
