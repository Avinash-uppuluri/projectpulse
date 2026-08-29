const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, default: 'Documentation' },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fileUrl: { type: String, required: true },
    version: { type: String, default: '1.0' },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Document', DocumentSchema);
