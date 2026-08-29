const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true }, // e.g. "created task"
    details: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Activity', ActivitySchema);
