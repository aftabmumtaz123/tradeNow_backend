const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: process.env.FRONTEND_URL || 'https://trade-now-umber.vercel.app', credentials: true }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/deposits', require('./routes/deposits'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/withdrawals', require('./routes/withdrawals'));
app.use('/api/users', require('./routes/users'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'AL ZAHRA TRADE API is running' });
});

const User = require('./models/User');
const Transaction = require('./models/Transaction');

const processDailyProfits = async () => {
  try {
    const now = new Date();
    const users = await User.find({
      currentPlan: { $ne: null },
      planEndDate: { $gte: now },
      isActive: true
    });
    for (const user of users) {
      const last = user.lastProfitDate ? new Date(user.lastProfitDate) : null;
      const shouldCredit = !last || (now - last) >= 24 * 60 * 60 * 1000;
      if (shouldCredit && user.dailyProfit > 0) {
        user.balance += user.dailyProfit;
        user.totalProfit += user.dailyProfit;
        user.lastProfitDate = now;
        await user.save();
        await Transaction.create({
          user: user._id,
          type: 'profit',
          amount: user.dailyProfit,
          balanceAfter: user.balance,
          description: 'Daily profit credited',
          status: 'completed'
        });
      }
    }
    console.log(`[Profit] Processed ${users.length} users`);
  } catch (err) {
    console.error('Daily profit error:', err.message);
  }
};

setInterval(processDailyProfits, 60 * 60 * 1000);

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/al-zahra-trade')
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    setTimeout(processDailyProfits, 5000);
  })
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
