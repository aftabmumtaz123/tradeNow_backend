const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  siteName: { type: String, default: 'A.U.S' },
  siteLogo: { type: String, default: '' },
  siteFavicon: { type: String, default: '' },
  primaryColor: { type: String, default: '#22c55e' },
  themeDefault: { type: String, enum: ['dark', 'light'], default: 'dark' },

  paymentAccounts: [{
    method: { type: String, enum: ['easypaisa', 'jazzcash', 'bank', 'other'], required: true },
    accountNumber: { type: String, required: true },
    accountName: { type: String, required: true },
    image: { type: String, default: '' }, // logo/icon for the method
    instructions: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  }],

  banners: [{
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    image: { type: String, default: '' },
    link: { type: String, default: '' },
    placement: { type: String, enum: ['landing', 'dashboard', 'both'], default: 'dashboard' },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  }],

  supportEmail: { type: String, default: 'support@alzahra.trade' },
  supportWhatsapp: { type: String, default: '' },
  supportPhone: { type: String, default: '' },
  minWithdrawal: { type: Number, default: 500 },
  maxWithdrawal: { type: Number, default: 500000 },
  referralEnabled: { type: Boolean, default: true },
  maintenanceMode: { type: Boolean, default: false },
  maintenanceMessage: { type: String, default: 'We are under maintenance. Please check back soon.' },

  landingHeadline: { type: String, default: 'Invest with clarity and confidence.' },
  landingSubheadline: {
    type: String,
    default: 'Create your account, choose a plan and manage deposits, withdrawals, profit history and referral rewards.',
  },

  // SEO / social
  metaTitle: { type: String, default: '' },
  metaDescription: { type: String, default: '' },
}, { timestamps: true });

settingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) settings = await this.create({});
  return settings;
};

module.exports = mongoose.model('Settings', settingsSchema);
