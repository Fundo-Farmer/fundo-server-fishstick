const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/fundo';
  await mongoose.connect(uri);
  console.log(`[fundo] MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
};

module.exports = connectDB;
