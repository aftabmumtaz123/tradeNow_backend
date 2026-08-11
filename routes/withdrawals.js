const express = require('express');
const router = express.Router();
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Settings = require('../models/Settings');
const { protect, admin } = require('../middleware/auth');

// User: Request withdrawal → status stays PENDING until admin marks paid
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
        message: 'You already have a pending withdrawal request. Wait until admin processes it.',
      });
    }

    // Hold amount from balance (not paid yet — pending until admin marks paid)
    user.balance -= amount;
    await user.save();

    const withdrawal = await Withdrawal.create({
      user: user._id,
      amount,
      paymentMethod,
      accountNumber: String(accountNumber).trim(),
      accountName: String(accountName).trim(),
      status: 'pending',
    });

    await Transaction.create({
      user: user._id,
      type: 'withdrawal',
      amount: -amount,
      balanceAfter: user.balance,
      description: `Withdrawal request (${paymentMethod}) — pending admin payment`,
      relatedId: withdrawal._id,
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      withdrawal,
      message: 'Withdrawal request submitted. Status: Pending until admin marks as paid.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// User: own history
router.get('/my', protect, async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, withdrawals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin: list (filter by status)
router.get('/admin/all', protect, admin, async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    const withdrawals = await Withdrawal.find(query)
      .populate('user', 'username email phone fullName')
      .sort({ createdAt: -1 });
    res.json({ success: true, withdrawals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin: Mark as PAID (money has been sent to user)
router.put('/admin/:id/paid', protect, admin, async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id).populate('user');
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    }
    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot mark as paid. Current status is "${withdrawal.status}".`,
      });
    }

    withdrawal.status = 'paid';
    withdrawal.reviewedBy = req.user._id;
    withdrawal.reviewedAt = new Date();
    withdrawal.paidAt = new Date();
    withdrawal.adminNote = req.body.note || 'Marked as paid by admin';
    await withdrawal.save();

    // Mark related transaction completed
    await Transaction.findOneAndUpdate(
      { relatedId: withdrawal._id, type: 'withdrawal' },
      {
        status: 'completed',
        description: `Withdrawal paid via ${withdrawal.paymentMethod}`,
      }
    );

    res.json({
      success: true,
      message: 'Withdrawal marked as paid',
      withdrawal,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// Admin: Reject → refund balance to user
router.put('/admin/:id/reject', protect, admin, async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal || withdrawal.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Invalid or already processed withdrawal' });
    }

    const user = await User.findById(withdrawal.user);
    user.balance += withdrawal.amount;
    await user.save();

    withdrawal.status = 'rejected';
    withdrawal.reviewedBy = req.user._id;
    withdrawal.reviewedAt = new Date();
    withdrawal.adminNote = req.body.note || 'Rejected by admin';
    await withdrawal.save();

    await Transaction.findOneAndUpdate(
      { relatedId: withdrawal._id, type: 'withdrawal' },
      { status: 'failed', description: 'Withdrawal rejected — amount refunded' }
    );

    await Transaction.create({
      user: user._id,
      type: 'withdrawal',
      amount: withdrawal.amount,
      balanceAfter: user.balance,
      description: 'Withdrawal rejected — amount refunded to balance',
      relatedId: withdrawal._id,
      status: 'completed',
    });

    res.json({
      success: true,
      message: 'Withdrawal rejected and amount refunded to user balance',
      withdrawal,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
