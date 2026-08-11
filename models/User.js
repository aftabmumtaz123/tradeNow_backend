const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  fullName: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  balance: {
    type: Number,
    default: 0
  },
  totalInvested: {
    type: Number,
    default: 0
  },
  totalProfit: {
    type: Number,
    default: 0
  },
  referralCode: {
    type: String,
    unique: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  currentPlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    default: null
  },
  planStartDate: {
    type: Date,
    default: null
  },
  planEndDate: {
    type: Date,
    default: null
  },
  dailyProfit: {
    type: Number,
    default: 0
  },
  lastProfitDate: {
    type: Date,
    default: null
  },
  avatar: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.pre('save', function(next) {
  if (!this.referralCode) {
    this.referralCode = this.username.toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
