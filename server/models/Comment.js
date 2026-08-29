const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['Project', 'Task', 'Issue', 'Milestone'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Comment', CommentSchema);
