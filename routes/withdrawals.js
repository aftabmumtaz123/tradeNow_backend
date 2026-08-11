const express = require('express');
const router = express.Router();
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Settings = require('../models/Settings');
const { protect, admin } = require('../middleware/auth');

// User: Request withdrawal
router.post('/', protect, async (req, res) => {
  try {
    const { amount, paymentMethod, accountNumber, accountName } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount required' });
    }
    if (!paymentMethod || !accountNumber || !accountName) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const settings = await Settings.getSettings();
    const minWithdraw = settings.minWithdrawal || 500;
    if (amount < minWithdraw) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal is ${minWithdraw} Rs`,
      });
    }

    const user = await User.findById(req.user._id);
    if (user.balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    const pending = await Withdrawal.findOne({ user: user._id, status: 'pending' });
    if (pending) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending withdrawal request',
      });
    }

    // Hold the amount
    user.balance -= amount;
    await user.save();

    const withdrawal = await Withdrawal.create({
      user: user._id,
      amount,
      paymentMethod,
      accountNumber,
      accountName,
      status: 'pending',
    });

    await Transaction.create({
      user: user._id,
      type: 'withdrawal',
      amount: -amount,
      balanceAfter: user.balance,
      description: `Withdrawal request via ${paymentMethod}`,
      relatedId: withdrawal._id,
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      withdrawal,
      message: 'Withdrawal request submitted. Waiting for admin approval.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// User: Get own withdrawals
router.get('/my', protect, async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, withdrawals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin: Get all / pending
router.get('/admin/all', protect, admin, async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    const withdrawals = await Withdrawal.find(query)
      .populate('user', 'username email phone')
      .sort({ createdAt: -1 });
    res.json({ success: true, withdrawals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin: Approve
router.put('/admin/:id/approve', protect, admin, async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id).populate('user');
    if (!withdrawal || withdrawal.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Invalid withdrawal' });
    }
    withdrawal.status = 'approved';
    withdrawal.reviewedBy = req.user._id;
    withdrawal.reviewedAt = new Date();
    withdrawal.adminNote = req.body.note || '';
    await withdrawal.save();

    await Transaction.findOneAndUpdate(
      { relatedId: withdrawal._id, type: 'withdrawal' },
      { status: 'completed' }
    );

    res.json({ success: true, message: 'Withdrawal approved', withdrawal });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin: Reject (refund balance)
router.put('/admin/:id/reject', protect, admin, async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal || withdrawal.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Invalid withdrawal' });
    }

    const user = await User.findById(withdrawal.user);
    user.balance += withdrawal.amount;
    await user.save();

    withdrawal.status = 'rejected';
    withdrawal.reviewedBy = req.user._id;
    withdrawal.reviewedAt = new Date();
    withdrawal.adminNote = req.body.note || 'Rejected by admin';
    await withdrawal.save();

    await Transaction.create({
      user: user._id,
      type: 'withdrawal',
      amount: withdrawal.amount,
      balanceAfter: user.balance,
      description: 'Withdrawal rejected - amount refunded',
      relatedId: withdrawal._id,
      status: 'completed',
    });

    res.json({ success: true, message: 'Withdrawal rejected and amount refunded', withdrawal });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
