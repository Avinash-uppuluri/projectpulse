const express = require('express');
const Issue = require('../models/Issue');
const { protect, blockViewer } = require('../middleware/authMiddleware');
const { logActivity, notifyUser, recalcProjectHealth } = require('../utils/helpers');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  const filter = {};
  if (req.query.project) filter.project = req.query.project;
  const issues = await Issue.find(filter)
    .populate('reportedBy assignedTo', 'name avatar')
    .sort('-createdAt');
  res.json(issues);
});

router.post('/', protect, blockViewer, async (req, res) => {
  const io = req.app.get('io');
  const issue = await Issue.create({ ...req.body, reportedBy: req.user._id });
  await logActivity(io, {
    project: issue.project,
    user: req.user._id,
    action: 'reported issue',
    details: issue.title,
  });
  if (issue.assignedTo) {
    await notifyUser(io, {
      user: issue.assignedTo,
      message: `New issue assigned: "${issue.title}"`,
      type: 'issue_created',
      project: issue.project,
    });
  }
  await recalcProjectHealth(io, issue.project);
  const populated = await issue.populate('reportedBy assignedTo', 'name avatar');
  io.to(`project:${issue.project}`).emit('issueCreated', populated);
  res.status(201).json(populated);
});

router.put('/:id', protect, blockViewer, async (req, res) => {
  const io = req.app.get('io');
  const issue = await Issue.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate(
    'reportedBy assignedTo',
    'name avatar'
  );
  if (!issue) return res.status(404).json({ message: 'Issue not found' });
  await recalcProjectHealth(io, issue.project);
  io.to(`project:${issue.project}`).emit('issueUpdated', issue);
  res.json(issue);
});

module.exports = router;
