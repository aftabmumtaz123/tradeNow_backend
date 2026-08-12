const multer = require('multer');
const path = require('path');

// Memory storage only — file goes to Cloudinary, never to local disk
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedExt = /jpeg|jpg|png|webp|gif/;
  const allowedMime = /image\/(jpeg|jpg|png|webp|gif)/;
  const ext = allowedExt.test(path.extname(file.originalname || '').toLowerCase());
  const mime = allowedMime.test(file.mimetype || '');
  if (ext && mime) cb(null, true);
  else cb(new Error('Only image files (JPG, PNG, WEBP) are allowed'));
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter,
});

module.exports = upload;
