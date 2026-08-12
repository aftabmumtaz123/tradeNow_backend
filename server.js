const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// CORS — FRONTEND_URL can be comma-separated list
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      try {
        const host = new URL(origin).hostname;
        if (
          allowedOrigins.includes('*') ||
          allowedOrigins.includes(origin) ||
          host.endsWith('.vercel.app')
        ) {
          return callback(null, true);
        }
      } catch (_) {}
      // Allow all in case of misconfig (login must work); log for debugging
      console.warn('CORS allowing unlisted origin:', origin);
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/deposits', require('./routes/deposits'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/withdrawals', require('./routes/withdrawals'));
app.use('/api/users', require('./routes/users'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'A.U.S API is running' });
});

app.get('/', (req, res) => {
  res.json({ name: 'A.U.S API', health: '/api/health' });
});

const User = require('./models/User');
const Transaction = require('./models/Transaction');

const processDailyProfits = async () => {
  try {
    const now = new Date();
    const users = await User.find({
      currentPlan: { $ne: null },
      planEndDate: { $gte: now },
      isActive: true,
    });
    for (const user of users) {
      const last = user.lastProfitDate ? new Date(user.lastProfitDate) : null;
      const shouldCredit = !last || now - last >= 24 * 60 * 60 * 1000;
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
          status: 'completed',
        });
      }
    }
  } catch (err) {
    console.error('Daily profit error:', err.message);
  }
};

// Local development only
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  mongoose
    .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/al-zahra-trade')
    .then(() => {
      console.log('MongoDB connected');
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
      setInterval(processDailyProfits, 60 * 60 * 1000);
      setTimeout(processDailyProfits, 5000);
    })
    .catch((err) => {
      console.error('MongoDB connection error:', err.message);
      process.exit(1);
    });
}

module.exports = app;
