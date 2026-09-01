const express = require('express');
const Project = require('../models/Project');
const Task = require('../models/Task');
const { protect, authorize } = require('../middleware/authMiddleware');
const { logActivity, recalcProjectHealth } = require('../utils/helpers');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  const projects = await Project.find({ archived: false })
    .populate('manager', 'name avatar')
    .populate('teamMembers', 'name avatar')
    .sort('-createdAt');
  res.json(projects);
});

router.get('/:id', protect, async (req, res) => {
  const project = await Project.findById(req.params.id)
    .populate('manager', 'name avatar email')
    .populate('teamMembers', 'name avatar email role');
  if (!project) return res.status(404).json({ message: 'Project not found' });
  res.json(project);
});

router.post('/', protect, async (req, res) => {
  try {
    const io = req.app.get('io');
    const project = await Project.create({
      ...req.body,
      manager: req.body.manager || req.user._id,
      teamMembers: req.body.teamMembers || [req.user._id],
    });
    await logActivity(io, {
      project: project._id,
      user: req.user._id,
      action: 'created project',
      details: project.name,
    });
    const populated = await project.populate('manager teamMembers', 'name avatar');
    io.emit('projectCreated', populated);
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create project', error: err.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const io = req.app.get('io');
    const project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate(
      'manager teamMembers',
      'name avatar'
    );
    if (!project) return res.status(404).json({ message: 'Project not found' });
    await logActivity(io, { project: project._id, user: req.user._id, action: 'updated project' });
    await recalcProjectHealth(io, project._id);
    io.to(`project:${project._id}`).emit('projectUpdated', project);
    res.json(project);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update project', error: err.message });
  }
});

router.delete('/:id', protect, authorize('manager'), async (req, res) => {
  const io = req.app.get('io');
  await Project.findByIdAndDelete(req.params.id);
  await Task.deleteMany({ project: req.params.id });
  io.emit('projectDeleted', { id: req.params.id });
  res.json({ message: 'Project deleted' });
});

router.put('/:id/archive', protect, authorize('manager'), async (req, res) => {
  const project = await Project.findByIdAndUpdate(req.params.id, { archived: true }, { new: true });
  res.json(project);
});

router.post('/:id/members', protect, async (req, res) => {
  const io = req.app.get('io');
  const project = await Project.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { teamMembers: req.body.userId } },
    { new: true }
  ).populate('teamMembers', 'name avatar');
  await logActivity(io, { project: project._id, user: req.user._id, action: 'added member' });
  io.to(`project:${project._id}`).emit('projectUpdated', project);
  res.json(project);
});

module.exports = router;
