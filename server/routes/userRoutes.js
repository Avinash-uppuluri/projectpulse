const express = require('express');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  const users = await User.find().select('-password').sort('name');
  res.json(users);
});

router.get('/:id', protect, async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
});

router.put('/:id', protect, async (req, res) => {
  if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const allowed = ['name', 'phone', 'department', 'avatar'];
  const updates = {};
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });
  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password');
  res.json(user);
});

router.put('/:id/password', protect, async (req, res) => {
  if (req.user._id.toString() !== req.params.id) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: 'A new password of at least 6 characters is required' });
  }
  const user = await User.findById(req.params.id).select('+password');
  const match = await user.comparePassword(currentPassword);
  if (!match) return res.status(400).json({ message: 'Current password is incorrect' });
  user.password = newPassword;
  await user.save();
  res.json({ message: 'Password updated successfully' });
});

router.put('/:id/block', protect, authorize('admin'), async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { status: req.body.status === 'active' ? 'active' : 'blocked' },
    { new: true }
  ).select('-password');
  res.json(user);
});

module.exports = router;
