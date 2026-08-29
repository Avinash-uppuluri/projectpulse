const Activity = require('../models/Activity');
const Notification = require('../models/Notification');
const Task = require('../models/Task');
const Issue = require('../models/Issue');
const Risk = require('../models/Risk');
const Milestone = require('../models/Milestone');
const Project = require('../models/Project');

async function logActivity(io, { project, user, action, details }) {
  const activity = await Activity.create({ project, user, action, details });
  const populated = await activity.populate('user', 'name avatar');
  if (io) io.to(`project:${project}`).emit('activityLogged', populated);
  return activity;
}

async function notifyUser(io, { user, message, type = 'info', project, link = '' }) {
  if (!user) return null;
  const notification = await Notification.create({ user, message, type, project, link });
  if (io) io.to(`user:${user}`).emit('notification', notification);
  return notification;
}

// Recalculate project progress based on task completion
async function recalcProjectProgress(io, projectId) {
  const tasks = await Task.find({ project: projectId });
  let progress = 0;
  if (tasks.length > 0) {
    const total = tasks.reduce((sum, t) => sum + (t.status === 'Completed' ? 100 : t.progress || 0), 0);
    progress = Math.round(total / tasks.length);
  }
  await Project.findByIdAndUpdate(projectId, { progress });
  await recalcProjectHealth(io, projectId);
  return progress;
}

// Health scoring algorithm per spec section 57
async function recalcProjectHealth(io, projectId) {
  const project = await Project.findById(projectId);
  if (!project) return;

  const tasks = await Task.find({ project: projectId });
  const issues = await Issue.find({ project: projectId, status: { $nin: ['Resolved', 'Closed'] } });
  const risks = await Risk.find({ project: projectId, status: { $ne: 'Closed' } });
  const milestones = await Milestone.find({ project: projectId });

  let score = 100;
  const now = new Date();

  const overdueTasks = tasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'Completed'
  );
  score -= overdueTasks.length * 5;

  const criticalIssues = issues.filter((i) => i.priority === 'Critical');
  score -= criticalIssues.length * 10;

  const highRisks = risks.filter((r) => r.level === 'HIGH' || r.level === 'CRITICAL');
  score -= highRisks.length * 8;

  const missedMilestones = milestones.filter(
    (m) => m.dueDate && new Date(m.dueDate) < now && m.status !== 'Completed'
  );
  score -= missedMilestones.length * 10;

  if (project.budget > 0 && project.usedBudget > project.budget) {
    score -= 15;
  }

  score = Math.max(0, Math.min(100, score));

  let health = 'GREEN';
  if (score < 60) health = 'RED';
  else if (score < 80) health = 'YELLOW';

  await Project.findByIdAndUpdate(projectId, { health, healthScore: score });

  if (io) {
    io.to(`project:${projectId}`).emit('projectHealthUpdated', { projectId, health, healthScore: score });
  }
  return { health, healthScore: score };
}

module.exports = { logActivity, notifyUser, recalcProjectProgress, recalcProjectHealth };
