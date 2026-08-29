const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    description: { type: String, default: '' },
    category: { type: String, default: 'General' },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    teamMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    budget: { type: Number, default: 0 },
    usedBudget: { type: Number, default: 0 },
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
    status: {
      type: String,
      enum: ['Planning', 'Active', 'On Hold', 'Delayed', 'Completed', 'Cancelled'],
      default: 'Planning',
    },
    progress: { type: Number, default: 0 },
    health: { type: String, enum: ['GREEN', 'YELLOW', 'RED'], default: 'GREEN' },
    healthScore: { type: Number, default: 100 },
    client: { type: String, default: '' },
    department: { type: String, default: '' },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Project', ProjectSchema);
