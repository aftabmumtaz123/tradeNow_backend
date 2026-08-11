const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Check if Cloudinary credentials are present
const useCloudinary =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

let upload;

if (useCloudinary) {
  // ===== Cloudinary mode =====
  console.log('📦 Upload: Using Cloudinary');
  const { uploadScreenshot } = require('../config/cloudinary');
  upload = uploadScreenshot;
} else {
  // ===== Local disk fallback =====
  console.log('📁 Upload: Using local disk (uploads/) — set Cloudinary env vars to enable cloud storage');
  const uploadDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    },
  });

  const fileFilter = (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Only image files (JPG, PNG, WEBP) are allowed'));
  };

  upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter,
  });
}

module.exports = upload;
