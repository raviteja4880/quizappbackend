const jwt = require('jsonwebtoken');
const User = require('../models/User'); // optional: fetch full user info

const authMiddleware = async (req, res, next) => {
  try {
    // ✅ Support both lowercase and uppercase headers
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader) {
      return res.status(401).json({ message: 'Access Denied: No token provided' });
    }

    // ✅ Extract token from "Bearer <token>"
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : authHeader;

    if (!token) {
      return res.status(401).json({ message: 'Access Denied: Invalid token format' });
    }

    // ✅ Verify token
    const verified = jwt.verify(token, process.env.JWT_SECRET);

    if (!verified._id) {
      return res.status(401).json({ message: 'Invalid Token: Missing user ID' });
    }

    // ✅ Optionally fetch user details from DB (if needed)
    const user = await User.findById(verified._id).select('-password');
    if (!user) return res.status(401).json({ message: 'User not found' });
    req.user = user;

    req.user = verified; // {_id, role} from JWT payload
    next();
  } catch (err) {
    console.error('Auth Middleware Error:', err.message);
    res.status(401).json({ message: 'Invalid Token', error: err.message });
  }
};

module.exports = authMiddleware;
