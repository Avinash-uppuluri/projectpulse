const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const { cloudinary, isConfigured: cloudinaryConfigured } = require('../config/cloudinary');
const Document = require('../models/Document');
const { protect, authorize, blockViewer } = require('../middleware/authMiddleware');
const { logActivity } = require('../utils/helpers');

const router = express.Router();

// Prefer Cloudinary so uploaded files survive server restarts/redeploys
// (hosts like Render's free/starter tiers wipe local disk on every deploy).
// Falls back to local disk automatically for local development without
// Cloudinary credentials set — but note local-disk files won't persist in
// production on most hosts.
//
// We hand-roll this instead of using a third-party multer-storage adapter:
// the popular one on npm only supports Cloudinary's older v1 SDK, and
// streaming the buffer straight to cloudinary.uploader.upload_stream is
// only a few lines anyway.
let storage;
if (cloudinaryConfigured) {
  storage = multer.memoryStorage();
} else {
  console.warn(
    '[documents] Cloudinary is not configured — falling back to local disk storage. ' +
      'Uploaded files will be LOST on redeploy/restart in production. Set ' +
      'CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET to fix this.'
  );
  const uploadDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  });
}
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

function uploadBufferToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'projectpulse-documents', resource_type: 'auto' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    Readable.from(buffer).pipe(uploadStream);
  });
}

router.get('/', protect, async (req, res) => {
  const filter = {};
  if (req.query.project) filter.project = req.query.project;
  const documents = await Document.find(filter).populate('uploadedBy', 'name avatar').sort('-createdAt');
  res.json(documents);
});

router.post('/', protect, blockViewer, upload.single('file'), async (req, res) => {
  const io = req.app.get('io');
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  let fileUrl;
  try {
    if (cloudinaryConfigured) {
      const result = await uploadBufferToCloudinary(req.file.buffer);
      fileUrl = result.secure_url;
    } else {
      fileUrl = `/uploads/${req.file.filename}`;
    }
  } catch (err) {
    return res.status(500).json({ message: 'File upload failed', error: err.message });
  }

  const doc = await Document.create({
    name: req.body.name || req.file.originalname,
    type: req.body.type || 'Documentation',
    project: req.body.project,
    uploadedBy: req.user._id,
    fileUrl,
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
