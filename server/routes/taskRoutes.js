const express = require('express');
const Task = require('../models/Task');
const { protect } = require('../middleware/authMiddleware');
const { logActivity, notifyUser, recalcProjectProgress } = require('../utils/helpers');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  const filter = {};
  if (req.query.project) filter.project = req.query.project;
  if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
  if (req.query.status) filter.status = req.query.status;
  const tasks = await Task.find(filter)
    .populate('assignedTo', 'name avatar')
    .populate('createdBy', 'name avatar')
    .sort('-createdAt');
  res.json(tasks);
});

router.get('/:id', protect, async (req, res) => {
  const task = await Task.findById(req.params.id).populate('assignedTo createdBy', 'name avatar');
  if (!task) return res.status(404).json({ message: 'Task not found' });
  res.json(task);
});

router.post('/', protect, async (req, res) => {
  try {
    const io = req.app.get('io');
    const task = await Task.create({ ...req.body, createdBy: req.user._id });
    const populated = await task.populate('assignedTo createdBy', 'name avatar');

    await logActivity(io, {
      project: task.project,
      user: req.user._id,
      action: 'created task',
      details: task.title,
    });

    if (task.assignedTo) {
      await notifyUser(io, {
        user: task.assignedTo,
        message: `You were assigned a new task: "${task.title}"`,
        type: 'task_assigned',
        project: task.project,
      });
    }

    await recalcProjectProgress(io, task.project);
    io.to(`project:${task.project}`).emit('taskCreated', populated);
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create task', error: err.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const io = req.app.get('io');
    const existing = await Task.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Task not found' });

    const previousStatus = existing.status;
    const previousAssignee = existing.assignedTo ? existing.assignedTo.toString() : null;

    if (req.body.status === 'Completed') req.body.progress = 100;

    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate(
      'assignedTo createdBy',
      'name avatar'
    );

    if (req.body.status && req.body.status !== previousStatus) {
      await logActivity(io, {
        project: task.project,
        user: req.user._id,
        action: 'changed task status',
        details: `"${task.title}": ${previousStatus} → ${task.status}`,
      });
    }

    if (req.body.assignedTo && req.body.assignedTo !== previousAssignee) {
      await notifyUser(io, {
        user: req.body.assignedTo,
        message: `You were assigned to task: "${task.title}"`,
        type: 'task_assigned',
        project: task.project,
      });
    }

    await recalcProjectProgress(io, task.project);
    io.to(`project:${task.project}`).emit('taskUpdated', task);
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update task', error: err.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  const io = req.app.get('io');
  const task = await Task.findByIdAndDelete(req.params.id);
  if (task) {
    await recalcProjectProgress(io, task.project);
    io.to(`project:${task.project}`).emit('taskDeleted', { id: req.params.id, project: task.project });
  }
  res.json({ message: 'Task deleted' });
});

module.exports = router;
