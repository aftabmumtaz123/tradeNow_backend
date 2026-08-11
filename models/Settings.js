const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  siteName: {
    type: String,
    default: 'AL ZAHRA TRADE'
  },
  siteLogo: {
    type: String,
    default: ''
  },
  siteFavicon: {
    type: String,
    default: ''
  },
  primaryColor: {
    type: String,
    default: '#22c55e'
  },
  // Payment accounts (managed by admin)
  paymentAccounts: [{
    method: {
      type: String,
      enum: ['easypaisa', 'jazzcash', 'bank'],
      required: true
    },
    accountNumber: {
      type: String,
      required: true
    },
    accountName: {
      type: String,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  // Banners for dashboard / landing
  banners: [{
    title: String,
    image: String,
    link: String,
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 }
  }],
  // Contact / support
  supportEmail: {
    type: String,
    default: 'support@alzahra.trade'
  },
  supportWhatsapp: {
    type: String,
    default: ''
  },
  // Min withdrawal
  minWithdrawal: {
    type: Number,
    default: 500
  },
  // Referral levels enabled
  referralEnabled: {
    type: Boolean,
    default: true
  },
  // Maintenance mode
  maintenanceMode: {
    type: Boolean,
    default: false
  },
  // Landing page content
  landingHeadline: {
    type: String,
    default: 'Invest with clarity and confidence.'
  },
  landingSubheadline: {
    type: String,
    default: 'Create your account, choose a plan and manage deposits, withdrawals, profit history and referral rewards.'
  }
}, {
  timestamps: true
});

// Ensure only one settings document
settingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model('Settings', settingsSchema);
