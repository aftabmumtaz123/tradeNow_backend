require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Plan = require('./models/Plan');
const Settings = require('./models/Settings');

const plans = [
  { name: 'ZAHRA-01', investment: 480, dailyProfit: 120, totalReturn: 7200, duration: 60, order: 1 },
  { name: 'ZAHRA-02', investment: 1280, dailyProfit: 320, totalReturn: 19200, duration: 60, order: 2 },
  { name: 'ZAHRA-03', investment: 2180, dailyProfit: 545, totalReturn: 32700, duration: 60, order: 3 },
  { name: 'ZAHRA-04', investment: 5000, dailyProfit: 1250, totalReturn: 75000, duration: 60, order: 4 },
  { name: 'ZAHRA-05', investment: 10000, dailyProfit: 2500, totalReturn: 150000, duration: 60, order: 5 },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/al-zahra-trade');
  console.log('Connected');

  // Clear
  await Plan.deleteMany({});
  await Settings.deleteMany({});

  // Plans
  await Plan.insertMany(plans);
  console.log('Plans seeded');

  // Settings with Easypaisa account from screenshots
  await Settings.create({
    siteName: 'AL ZAHRA TRADE',
    paymentAccounts: [
      { method: 'easypaisa', accountNumber: '03423176901', accountName: 'Nazeeran bibi', isActive: true }
    ],
    landingHeadline: 'Invest with clarity and confidence.',
    landingSubheadline: 'Create your account, choose a plan and manage deposits, withdrawals, profit history and referral rewards.'
  });
  console.log('Settings seeded');

  // Admin user
  const adminExists = await User.findOne({ role: 'admin' });
  if (!adminExists) {
    await User.create({
      username: 'admin',
      email: 'admin@alzahra.trade',
      password: 'admin123',
      fullName: 'System Admin',
      role: 'admin',
      isVerified: true
    });
    console.log('Admin created: admin@alzahra.trade / admin123');
  }

  console.log('Seed complete');
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
