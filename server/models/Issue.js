const mongoose = require('mongoose');

const IssueSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
    status: {
      type: String,
      enum: ['Open', 'Investigating', 'In Progress', 'Resolved', 'Closed'],
      default: 'Open',
    },
    dueDate: { type: Date },
    resolution: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Issue', IssueSchema);
