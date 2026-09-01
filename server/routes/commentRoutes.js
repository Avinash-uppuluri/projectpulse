const express = require('express');
const Comment = require('../models/Comment');
const { protect, blockViewer } = require('../middleware/authMiddleware');
const { logActivity } = require('../utils/helpers');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  const filter = {};
  if (req.query.targetType) filter.targetType = req.query.targetType;
  if (req.query.targetId) filter.targetId = req.query.targetId;
  const comments = await Comment.find(filter).populate('user', 'name avatar').sort('createdAt');
  res.json(comments);
});

router.post('/', protect, blockViewer, async (req, res) => {
  const io = req.app.get('io');
  const comment = await Comment.create({ ...req.body, user: req.user._id });
  const populated = await comment.populate('user', 'name avatar');
  await logActivity(io, {
    project: comment.project,
    user: req.user._id,
    action: `commented on ${comment.targetType.toLowerCase()}`,
  });
  io.to(`project:${comment.project}`).emit('commentAdded', populated);
  res.status(201).json(populated);
});

router.delete('/:id', protect, async (req, res) => {
  const io = req.app.get('io');
  const comment = await Comment.findById(req.params.id);
  if (!comment) return res.status(404).json({ message: 'Comment not found' });
  if (comment.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  await comment.deleteOne();
  io.to(`project:${comment.project}`).emit('commentDeleted', { id: req.params.id });
  res.json({ message: 'Comment deleted' });
});

module.exports = router;
