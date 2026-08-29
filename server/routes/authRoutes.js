const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

    try {
      const { name, email, password, phone, department, role } = req.body;
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) return res.status(400).json({ message: 'Email already registered' });

      const user = await User.create({
        name,
        email,
        password,
        phone,
        department,
        role: ['admin', 'manager', 'member', 'viewer'].includes(role) ? role : 'member',
      });

      const token = signToken(user);
      res.status(201).json({ token, user: user.toSafeObject() });
    } catch (err) {
      res.status(500).json({ message: 'Registration failed', error: err.message });
    }
  }
);

router.post(
  '/login',
  [body('email').isEmail(), body('password').notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Invalid email or password' });

    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
      if (!user) return res.status(400).json({ message: 'Invalid email or password' });
      if (user.status === 'blocked') return res.status(403).json({ message: 'Account is blocked' });

      const match = await user.comparePassword(password);
      if (!match) return res.status(400).json({ message: 'Invalid email or password' });

      user.online = true;
      user.lastSeen = new Date();
      await user.save();

      const token = signToken(user);
      res.json({ token, user: user.toSafeObject() });
    } catch (err) {
      res.status(500).json({ message: 'Login failed', error: err.message });
    }
  }
);

router.get('/me', protect, async (req, res) => {
  res.json({ user: req.user.toSafeObject() });
});

module.exports = router;
