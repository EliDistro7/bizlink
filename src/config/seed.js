require('dotenv').config();
const connectDB = require('./db');
const User = require('../models/User');

const seed = async () => {
  await connectDB();

  // Remove existing demo user if present
  await User.deleteOne({ email: 'demo@pharmalink.test' });

  await User.create({
    name: 'Demo Admin',
    email: 'demo@pharmalink.test',
    passwordHash: 'placeholder', // pre-save hook will hash this
    role: 'super_admin',
    branchId: null,
    isActive: true,
  });

  console.log('✅ Seed complete: demo@pharmalink.test / placeholder (super_admin)');
  process.exit(0);
};

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});