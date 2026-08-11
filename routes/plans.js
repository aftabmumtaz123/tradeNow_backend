const express = require('express');
const router = express.Router();
const Plan = require('../models/Plan');
const { protect, admin } = require('../middleware/auth');

// Public: Get active plans
router.get('/', async (req, res) => {
  const plans = await Plan.find({ isActive: true }).sort({ order: 1, investment: 1 });
  res.json({ success: true, plans });
});

// Admin: CRUD
router.post('/', protect, admin, async (req, res) => {
  try {
    const plan = await Plan.create(req.body);
    res.status(201).json({ success: true, plan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', protect, admin, async (req, res) => {
  try {
    const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.json({ success: true, plan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', protect, admin, async (req, res) => {
  try {
    await Plan.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Plan deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
