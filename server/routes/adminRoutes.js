const express = require('express');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Milestone = require('../models/Milestone');
const { protect } = require('../middleware/authMiddleware');
const { logActivity, recalcProjectProgress } = require('../utils/helpers');

const router = express.Router();

// Lets any signed-in user populate the workspace with a realistic sample
// project (used by the "Load Demo Data" button on the dashboard).
router.post('/seed-demo', protect, async (req, res) => {
  try {
    const io = req.app.get('io');
    const project = await Project.create({
      name: `Demo Project — ${new Date().toLocaleDateString()}`,
      code: `DEMO-${Math.floor(Math.random() * 900 + 100)}`,
      description: 'Sample project auto-generated to showcase ProjectPulse features.',
      category: 'Demo',
      manager: req.user._id,
      teamMembers: [req.user._id],
      startDate: new Date(),
      endDate: new Date(Date.now() + 45 * 86400000),
      budget: 50000,
      usedBudget: 12000,
      priority: 'Medium',
      status: 'Active',
    });

    const titles = ['Set up repository', 'Design database schema', 'Build login page', 'Create dashboard UI', 'Write tests'];
    const statuses = ['To Do', 'In Progress', 'Review', 'Completed', 'Backlog'];
    for (let i = 0; i < titles.length; i++) {
      await Task.create({
        title: titles[i],
        project: project._id,
        assignedTo: req.user._id,
        createdBy: req.user._id,
        status: statuses[i],
        progress: statuses[i] === 'Completed' ? 100 : i * 20,
        priority: ['Low', 'Medium', 'High', 'Critical', 'Medium'][i],
        dueDate: new Date(Date.now() + (i + 1) * 5 * 86400000),
      });
    }

    const milestoneNames = ['Requirements Completed', 'UI Completed', 'Backend Completed'];
    for (let i = 0; i < milestoneNames.length; i++) {
      await Milestone.create({
        name: milestoneNames[i],
        project: project._id,
        owner: req.user._id,
        dueDate: new Date(Date.now() + (i + 1) * 10 * 86400000),
        status: i === 0 ? 'Completed' : 'Pending',
        completion: i === 0 ? 100 : 0,
        order: i,
      });
    }

    await logActivity(io, { project: project._id, user: req.user._id, action: 'loaded demo data' });
    await recalcProjectProgress(io, project._id);
    io.emit('projectCreated', await project.populate('manager teamMembers', 'name avatar'));

    res.status(201).json({ message: 'Demo project created', project });
  } catch (err) {
    res.status(500).json({ message: 'Failed to seed demo data', error: err.message });
  }
});

module.exports = router;
