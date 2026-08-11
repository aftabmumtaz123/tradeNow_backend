const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Deposit = require('../models/Deposit');
const Withdrawal = require('../models/Withdrawal');
const { protect, admin } = require('../middleware/auth');

// Get my team (direct referrals + levels)
router.get('/team', protect, async (req, res) => {
  try {
    const level1 = await User.find({ referredBy: req.user._id })
      .select('username email fullName phone createdAt totalInvested isVerified currentPlan')
      .populate('currentPlan', 'name');

    const level1Ids = level1.map((u) => u._id);
    const level2 = await User.find({ referredBy: { $in: level1Ids } })
      .select('username email fullName createdAt totalInvested referredBy')
      .populate('referredBy', 'username');

    const level2Ids = level2.map((u) => u._id);
    const level3 = await User.find({ referredBy: { $in: level2Ids } })
      .select('username email fullName createdAt totalInvested referredBy')
      .populate('referredBy', 'username');

    const me = await User.findById(req.user._id).select('referralCode');

    res.json({
      success: true,
      referralCode: me.referralCode,
      referralLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/register?ref=${me.referralCode}`,
      team: { level1, level2, level3 },
      counts: {
        level1: level1.length,
        level2: level2.length,
        level3: level3.length,
        total: level1.length + level2.length + level3.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get my transactions
router.get('/transactions', protect, async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin: list all users
router.get('/admin/all', protect, admin, async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { username: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { phone: new RegExp(search, 'i') },
      ];
    }
    const users = await User.find(query)
      .select('-password')
      .populate('currentPlan', 'name investment')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await User.countDocuments(query);
    res.json({ success: true, users, total, page: Number(page) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin: toggle user active
router.put('/admin/:id/toggle', protect, admin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot deactivate admin' });
    }
    user.isActive = !user.isActive;
    await user.save();
    res.json({ success: true, user, message: user.isActive ? 'User activated' : 'User deactivated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin dashboard stats + analytics
router.get('/admin/stats', protect, admin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    const activePlans = await User.countDocuments({ currentPlan: { $ne: null } });
    const pendingDeposits = await Deposit.countDocuments({ status: 'pending' });
    const pendingWithdrawals = await Withdrawal.countDocuments({ status: 'pending' });
    const approvedDeposits = await Deposit.countDocuments({ status: 'approved' });
    const rejectedDeposits = await Deposit.countDocuments({ status: 'rejected' });

    const totalInvested = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$totalInvested' } } },
    ]);
    const totalProfit = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$totalProfit' } } },
    ]);

    // Last 7 days user registrations
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const usersByDay = await User.aggregate([
      { $match: { role: 'user', createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const depositsByDay = await Deposit.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          amount: { $sum: '$amount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const depositsByStatus = [
      { name: 'Pending', value: pendingDeposits },
      { name: 'Approved', value: approvedDeposits },
      { name: 'Rejected', value: rejectedDeposits },
    ];

    // Fill last 7 days labels
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const userSeries = days.map((day) => ({
      date: day,
      users: usersByDay.find((x) => x._id === day)?.count || 0,
    }));
    const depositSeries = days.map((day) => {
      const row = depositsByDay.find((x) => x._id === day);
      return { date: day, count: row?.count || 0, amount: row?.amount || 0 };
    });

    res.json({
      success: true,
      stats: {
        totalUsers,
        activePlans,
        pendingDeposits,
        pendingWithdrawals,
        approvedDeposits,
        rejectedDeposits,
        totalInvested: totalInvested[0]?.total || 0,
        totalProfit: totalProfit[0]?.total || 0,
      },
      charts: {
        usersByDay: userSeries,
        depositsByDay: depositSeries,
        depositsByStatus,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
