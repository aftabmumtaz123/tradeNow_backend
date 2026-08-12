const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const app = require('../server');

let cached = global.__mongo;
if (!cached) {
  cached = global.__mongo = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGODB_URI)
      .then((m) => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    console.error('DB connect error:', err);
    return res.status(500).json({ success: false, message: 'Database connection failed' });
  }
  return app(req, res);
};
