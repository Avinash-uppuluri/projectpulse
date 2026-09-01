const express = require('express');
const Milestone = require('../models/Milestone');
const { protect, authorize } = require('../middleware/authMiddleware');
const { logActivity, recalcProjectHealth } = require('../utils/helpers');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  const filter = {};
  if (req.query.project) filter.project = req.query.project;
  const milestones = await Milestone.find(filter).populate('owner', 'name avatar').sort('order dueDate');
  res.json(milestones);
});

router.post('/', protect, authorize('manager', 'admin'), async (req, res) => {
  const io = req.app.get('io');
  const milestone = await Milestone.create(req.body);
  await logActivity(io, {
    project: milestone.project,
    user: req.user._id,
    action: 'created milestone',
    details: milestone.name,
  });
  io.to(`project:${milestone.project}`).emit('milestoneUpdated', milestone);
  res.status(201).json(milestone);
});

router.put('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
  const io = req.app.get('io');
  const milestone = await Milestone.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!milestone) return res.status(404).json({ message: 'Milestone not found' });
  await recalcProjectHealth(io, milestone.project);
  io.to(`project:${milestone.project}`).emit('milestoneUpdated', milestone);
  res.json(milestone);
});

router.delete('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
  const io = req.app.get('io');
  const milestone = await Milestone.findByIdAndDelete(req.params.id);
  if (milestone) io.to(`project:${milestone.project}`).emit('milestoneDeleted', { id: req.params.id });
  res.json({ message: 'Milestone deleted' });
});

module.exports = router;
