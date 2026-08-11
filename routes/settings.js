const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const { protect, admin } = require('../middleware/auth');

// Decide which uploader to use
const useCloudinary =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

let uploadAsset;
if (useCloudinary) {
  const { uploadAsset: cloudUpload } = require('../config/cloudinary');
  uploadAsset = cloudUpload;
} else {
  uploadAsset = require('../middleware/upload');
}

const getFileUrl = (file) => {
  if (!file) return null;
  if (file.path && file.path.startsWith('http')) return file.path;
  if (file.secure_url) return file.secure_url;
  if (file.url) return file.url;
  return `/uploads/${file.filename}`;
};

// Public: Get public settings
router.get('/public', async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json({
      success: true,
      settings: {
        siteName: settings.siteName,
        siteLogo: settings.siteLogo,
        primaryColor: settings.primaryColor,
        paymentAccounts: (settings.paymentAccounts || []).filter((a) => a.isActive),
        banners: (settings.banners || []).filter((b) => b.isActive),
        landingHeadline: settings.landingHeadline,
        landingSubheadline: settings.landingSubheadline,
        supportWhatsapp: settings.supportWhatsapp,
        minWithdrawal: settings.minWithdrawal,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin: Get full settings
router.get('/', protect, admin, async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin: Update settings
router.put('/', protect, admin, async (req, res) => {
  try {
    let settings = await Settings.getSettings();
    Object.assign(settings, req.body);
    await settings.save();
    res.json({ success: true, settings, message: 'Settings updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin: Upload logo / banner / asset
router.post('/upload', protect, admin, (req, res) => {
  uploadAsset.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Upload failed',
      });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const url = getFileUrl(req.file);
    res.json({ success: true, url });
  });
});

module.exports = router;
