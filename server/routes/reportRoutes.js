const express = require('express');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Issue = require('../models/Issue');
const Risk = require('../models/Risk');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Overall system/dashboard stats
router.get('/dashboard', protect, async (req, res) => {
  const [projects, tasks, users] = await Promise.all([Project.find(), Task.find(), User.find()]);

  const stats = {
    totalProjects: projects.length,
    activeProjects: projects.filter((p) => p.status === 'Active').length,
    completedProjects: projects.filter((p) => p.status === 'Completed').length,
    delayedProjects: projects.filter((p) => p.status === 'Delayed').length,
    totalTasks: tasks.length,
    completedTasks: tasks.filter((t) => t.status === 'Completed').length,
    pendingTasks: tasks.filter((t) => t.status !== 'Completed').length,
    teamMembers: users.length,
  };

  const statusDistribution = {};
  tasks.forEach((t) => {
    statusDistribution[t.status] = (statusDistribution[t.status] || 0) + 1;
  });

  res.json({ stats, statusDistribution, projects });
});

// Single project report
router.get('/project/:id', protect, async (req, res) => {
  const projectId = req.params.id;
  const [project, tasks, issues, risks] = await Promise.all([
    Project.findById(projectId).populate('manager teamMembers', 'name avatar'),
    Task.find({ project: projectId }).populate('assignedTo', 'name avatar'),
    Issue.find({ project: projectId }),
    Risk.find({ project: projectId }),
  ]);

  if (!project) return res.status(404).json({ message: 'Project not found' });

  const taskStatus = {};
  tasks.forEach((t) => {
    taskStatus[t.status] = (taskStatus[t.status] || 0) + 1;
  });

  const issuesByPriority = {};
  issues.forEach((i) => {
    issuesByPriority[i.priority] = (issuesByPriority[i.priority] || 0) + 1;
  });

  const riskDistribution = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  risks.forEach((r) => {
    riskDistribution[r.level] = (riskDistribution[r.level] || 0) + 1;
  });

  // Team performance: completed tasks / assigned tasks per user
  const perfMap = {};
  tasks.forEach((t) => {
    if (!t.assignedTo) return;
    const id = t.assignedTo._id.toString();
    if (!perfMap[id]) perfMap[id] = { name: t.assignedTo.name, assigned: 0, completed: 0 };
    perfMap[id].assigned += 1;
    if (t.status === 'Completed') perfMap[id].completed += 1;
  });
  const teamPerformance = Object.values(perfMap).map((p) => ({
    ...p,
    performance: p.assigned ? Math.round((p.completed / p.assigned) * 100) : 0,
  }));

  const budgetUsedPct = project.budget > 0 ? Math.round((project.usedBudget / project.budget) * 100) : 0;

  res.json({
    project,
    taskStatus,
    issuesByPriority,
    riskDistribution,
    teamPerformance,
    budget: {
      total: project.budget,
      used: project.usedBudget,
      remaining: project.budget - project.usedBudget,
      usedPct: budgetUsedPct,
    },
  });
});

module.exports = router;
