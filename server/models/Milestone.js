const mongoose = require('mongoose');

const MilestoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    startDate: { type: Date, default: Date.now },
    dueDate: { type: Date },
    status: { type: String, enum: ['Pending', 'In Progress', 'Completed', 'Missed'], default: 'Pending' },
    completion: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Milestone', MilestoneSchema);
