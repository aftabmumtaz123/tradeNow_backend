const express = require('express');
const router = express.Router();
const Deposit = require('../models/Deposit');
const Plan = require('../models/Plan');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { protect, admin } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadBuffer } = require('../config/cloudinary');

const handleMulter = (req, res, next) => {
  upload.single('screenshot')(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err.message);
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed. Use JPG or PNG under 5MB.',
      });
    }
    next();
  });
};

// User: Submit deposit — image goes to Cloudinary, URL saved in MongoDB
router.post('/', protect, handleMulter, async (req, res) => {
  try {
    const { planId, transactionId, paymentMethod } = req.body;

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'Screenshot is required' });
    }
    if (!transactionId || !String(transactionId).trim()) {
      return res.status(400).json({ success: false, message: 'Transaction ID is required' });
    }
    if (!planId) {
      return res.status(400).json({ success: false, message: 'Plan is required' });
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }
    if (!plan.isActive) {
      return res.status(400).json({ success: false, message: 'Plan is not active' });
    }

    const pending = await Deposit.findOne({ user: req.user._id, status: 'pending' });
    if (pending) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending deposit request. Please wait for admin review.',
      });
    }

    // Upload to Cloudinary — must return https URL
    let screenshotUrl;
    try {
      const uploaded = await uploadBuffer(req.file.buffer, {
        folder: 'al-zahra-trade/screenshots',
        prefix: 'deposit',
      });
      screenshotUrl = uploaded.url;
    } catch (cloudErr) {
      console.error('Cloudinary error:', cloudErr);
      return res.status(500).json({
        success: false,
        message:
          cloudErr.message ||
          'Image upload to Cloudinary failed. Check CLOUDINARY_* environment variables.',
      });
    }

    if (!screenshotUrl || !screenshotUrl.startsWith('http')) {
      return res.status(500).json({
        success: false,
        message: 'Invalid image URL from Cloudinary',
      });
    }

    const deposit = await Deposit.create({
      user: req.user._id,
      plan: planId,
      amount: plan.investment,
      paymentMethod: paymentMethod || 'easypaisa',
      transactionId: String(transactionId).trim(),
      screenshot: screenshotUrl, // full Cloudinary HTTPS URL in MongoDB
      status: 'pending',
    });

    console.log('Deposit created:', deposit._id, '| screenshot:', screenshotUrl);

    res.status(201).json({
      success: true,
      deposit,
      message: 'Deposit request submitted. Waiting for admin approval.',
    });
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while creating deposit',
    });
  }
});

router.get('/my', protect, async (req, res) => {
  try {
    const deposits = await Deposit.find({ user: req.user._id })
      .populate('plan', 'name investment dailyProfit')
      .sort({ createdAt: -1 });
    res.json({ success: true, deposits });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/admin/pending', protect, admin, async (req, res) => {
  try {
    const deposits = await Deposit.find({ status: 'pending' })
      .populate('user', 'username email phone fullName')
      .populate('plan', 'name investment dailyProfit duration')
      .sort({ createdAt: -1 });
    res.json({ success: true, deposits });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/admin/all', protect, admin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = status ? { status } : {};
    const deposits = await Deposit.find(query)
      .populate('user', 'username email phone')
      .populate('plan', 'name investment')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await Deposit.countDocuments(query);
    res.json({ success: true, deposits, total, page: Number(page) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/admin/:id/approve', protect, admin, async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id).populate('plan').populate('user');
    if (!deposit) return res.status(404).json({ success: false, message: 'Deposit not found' });
    if (deposit.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Deposit already processed' });
    }

    deposit.status = 'approved';
    deposit.reviewedBy = req.user._id;
    deposit.reviewedAt = new Date();
    deposit.adminNote = req.body.note || '';
    await deposit.save();

    const user = await User.findById(deposit.user._id);
    const plan = deposit.plan;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.duration);

    user.currentPlan = plan._id;
    user.planStartDate = startDate;
    user.planEndDate = endDate;
    user.dailyProfit = plan.dailyProfit;
    user.totalInvested = (user.totalInvested || 0) + plan.investment;
    user.isVerified = true;
    await user.save();

    await Transaction.create({
      user: user._id,
      type: 'plan_purchase',
      amount: plan.investment,
      balanceAfter: user.balance,
      description: `Plan ${plan.name} activated`,
      relatedId: deposit._id,
      status: 'completed',
    });

    if (user.referredBy) {
      const level1 = await User.findById(user.referredBy);
      if (level1) {
        const bonus1 = (plan.investment * (plan.referralBonus?.level1 || 13)) / 100;
        level1.balance += bonus1;
        level1.totalProfit = (level1.totalProfit || 0) + bonus1;
        await level1.save();
        await Transaction.create({
          user: level1._id,
          type: 'referral_bonus',
          amount: bonus1,
          balanceAfter: level1.balance,
          description: `Level 1 referral bonus from ${user.username}`,
          status: 'completed',
        });
        if (level1.referredBy) {
          const level2 = await User.findById(level1.referredBy);
          if (level2) {
            const bonus2 = (plan.investment * (plan.referralBonus?.level2 || 3)) / 100;
            level2.balance += bonus2;
            level2.totalProfit = (level2.totalProfit || 0) + bonus2;
            await level2.save();
            await Transaction.create({
              user: level2._id,
              type: 'referral_bonus',
              amount: bonus2,
              balanceAfter: level2.balance,
              description: `Level 2 referral bonus from ${user.username}`,
              status: 'completed',
            });
          }
        }
      }
    }

    res.json({ success: true, message: 'Deposit approved. Plan activated.', deposit });
  } catch (error) {
    console.error('Approve error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/admin/:id/reject', protect, admin, async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);
    if (!deposit || deposit.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Invalid deposit' });
    }
    deposit.status = 'rejected';
    deposit.reviewedBy = req.user._id;
    deposit.reviewedAt = new Date();
    deposit.adminNote = req.body.note || 'Rejected by admin';
    await deposit.save();
    res.json({ success: true, message: 'Deposit rejected', deposit });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
