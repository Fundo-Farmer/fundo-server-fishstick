require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const { ROLES } = require('../config/constants');

const run = async () => {
  await connectDB();
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@fundo.africa').toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`[fundo] Super admin already exists: ${email}`);
  } else {
    await User.create({
      name: process.env.BOOTSTRAP_ADMIN_NAME || 'Fundo Admin',
      email,
      password: process.env.BOOTSTRAP_ADMIN_PASSWORD || 'ChangeMe123!',
      role: ROLES.SUPER_ADMIN,
    });
    console.log(`[fundo] Super admin created: ${email}`);
  }
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
