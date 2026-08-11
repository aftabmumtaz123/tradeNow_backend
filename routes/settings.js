const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const { protect, admin } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadBuffer } = require('../config/cloudinary');

router.get('/public', async (req, res) => {
  try {
    const s = await Settings.getSettings();
    res.json({
      success: true,
      settings: {
        siteName: s.siteName,
        siteLogo: s.siteLogo,
        siteFavicon: s.siteFavicon,
        primaryColor: s.primaryColor,
        themeDefault: s.themeDefault,
        paymentAccounts: (s.paymentAccounts || []).filter((a) => a.isActive !== false),
        banners: (s.banners || [])
          .filter((b) => b.isActive !== false)
          .sort((a, b) => (a.order || 0) - (b.order || 0)),
        landingHeadline: s.landingHeadline,
        landingSubheadline: s.landingSubheadline,
        supportWhatsapp: s.supportWhatsapp,
        supportEmail: s.supportEmail,
        supportPhone: s.supportPhone,
        minWithdrawal: s.minWithdrawal,
        maxWithdrawal: s.maxWithdrawal,
        maintenanceMode: s.maintenanceMode,
        maintenanceMessage: s.maintenanceMessage,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/', protect, admin, async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/', protect, admin, async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const body = req.body || {};

    const scalars = [
      'siteName', 'siteLogo', 'siteFavicon', 'primaryColor', 'themeDefault',
      'supportEmail', 'supportWhatsapp', 'supportPhone',
      'minWithdrawal', 'maxWithdrawal', 'referralEnabled',
      'maintenanceMode', 'maintenanceMessage',
      'landingHeadline', 'landingSubheadline', 'metaTitle', 'metaDescription',
    ];
    for (const key of scalars) {
      if (body[key] !== undefined) settings[key] = body[key];
    }

    if (Array.isArray(body.paymentAccounts)) {
      settings.paymentAccounts = body.paymentAccounts.map((a) => ({
        method: a.method || 'easypaisa',
        accountNumber: String(a.accountNumber || '').trim(),
        accountName: String(a.accountName || '').trim(),
        image: a.image || '',
        instructions: a.instructions || '',
        isActive: a.isActive !== false,
      }));
      settings.markModified('paymentAccounts');
    }

    if (Array.isArray(body.banners)) {
      settings.banners = body.banners.map((b, i) => ({
        title: b.title || '',
        subtitle: b.subtitle || '',
        image: b.image || '',
        link: b.link || '',
        placement: b.placement || 'dashboard',
        isActive: b.isActive !== false,
        order: b.order ?? i,
      }));
      settings.markModified('banners');
    }

    await settings.save();
    res.json({ success: true, settings, message: 'Settings updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin: upload logo / banner / payment image → Cloudinary → return HTTPS URL
router.post('/upload', protect, admin, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'Upload failed' });
    }
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    try {
      const uploaded = await uploadBuffer(req.file.buffer, {
        folder: 'al-zahra-trade/assets',
        prefix: 'asset',
      });
      res.json({ success: true, url: uploaded.url });
    } catch (cloudErr) {
      console.error('Cloudinary settings upload error:', cloudErr);
      res.status(500).json({
        success: false,
        message:
          cloudErr.message ||
          'Cloudinary upload failed. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.',
      });
    }
  });
});

module.exports = router;
