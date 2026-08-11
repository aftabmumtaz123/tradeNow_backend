const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  investment: {
    type: Number,
    required: true
  },
  dailyProfit: {
    type: Number,
    required: true
  },
  totalReturn: {
    type: Number,
    required: true
  },
  duration: {
    type: Number, // days
    required: true,
    default: 60
  },
  referralBonus: {
    level1: { type: Number, default: 13 }, // %
    level2: { type: Number, default: 3 },
    level3: { type: Number, default: 1 }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    default: ''
  },
  color: {
    type: String,
    default: '#22c55e'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Plan', planSchema);
