const express = require('express');
const Risk = require('../models/Risk');
const { protect } = require('../middleware/authMiddleware');
const { logActivity, recalcProjectHealth } = require('../utils/helpers');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  const filter = {};
  if (req.query.project) filter.project = req.query.project;
  const risks = await Risk.find(filter).populate('owner', 'name avatar').sort('-riskScore');
  res.json(risks);
});

router.post('/', protect, async (req, res) => {
  const io = req.app.get('io');
  const risk = await Risk.create(req.body);
  await logActivity(io, {
    project: risk.project,
    user: req.user._id,
    action: 'logged risk',
    details: `${risk.name} (${risk.level})`,
  });
  await recalcProjectHealth(io, risk.project);
  const populated = await risk.populate('owner', 'name avatar');
  io.to(`project:${risk.project}`).emit('riskCreated', populated);
  res.status(201).json(populated);
});

router.put('/:id', protect, async (req, res) => {
  const io = req.app.get('io');
  const risk = await Risk.findById(req.params.id);
  if (!risk) return res.status(404).json({ message: 'Risk not found' });
  Object.assign(risk, req.body);
  await risk.save();
  await recalcProjectHealth(io, risk.project);
  io.to(`project:${risk.project}`).emit('riskUpdated', risk);
  res.json(risk);
});

module.exports = router;
