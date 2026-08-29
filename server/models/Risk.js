const mongoose = require('mongoose');

const RiskSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    probability: { type: Number, min: 1, max: 5, default: 3 }, // 1-5
    impact: { type: Number, min: 1, max: 5, default: 3 }, // 1-5
    riskScore: { type: Number, default: 9 },
    level: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
    mitigation: { type: String, default: '' },
    status: { type: String, enum: ['Open', 'Mitigated', 'Closed'], default: 'Open' },
  },
  { timestamps: true }
);

RiskSchema.pre('save', function (next) {
  this.riskScore = this.probability * this.impact;
  if (this.riskScore >= 20) this.level = 'CRITICAL';
  else if (this.riskScore >= 12) this.level = 'HIGH';
  else if (this.riskScore >= 6) this.level = 'MEDIUM';
  else this.level = 'LOW';
  next();
});

module.exports = mongoose.model('Risk', RiskSchema);
