const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Document = require('../models/Document');
const { protect, authorize, blockViewer } = require('../middleware/authMiddleware');
const { logActivity } = require('../utils/helpers');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', protect, async (req, res) => {
  const filter = {};
  if (req.query.project) filter.project = req.query.project;
  const documents = await Document.find(filter).populate('uploadedBy', 'name avatar').sort('-createdAt');
  res.json(documents);
});

router.post('/', protect, blockViewer, upload.single('file'), async (req, res) => {
  const io = req.app.get('io');
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const doc = await Document.create({
    name: req.body.name || req.file.originalname,
    type: req.body.type || 'Documentation',
    project: req.body.project,
    uploadedBy: req.user._id,
    fileUrl: `/uploads/${req.file.filename}`,
    description: req.body.description || '',
  });

  await logActivity(io, {
    project: doc.project,
    user: req.user._id,
    action: 'uploaded document',
    details: doc.name,
  });

  const populated = await doc.populate('uploadedBy', 'name avatar');
  io.to(`project:${doc.project}`).emit('documentUploaded', populated);
  res.status(201).json(populated);
});

router.delete('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
  const doc = await Document.findByIdAndDelete(req.params.id);
  res.json({ message: 'Document deleted', doc });
});

module.exports = router;
