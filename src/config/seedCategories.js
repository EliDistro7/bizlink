// scripts/seedCategories.js
require('dotenv').config();
const connectDB = require('./db');
const Category = require('../models/Category');

const seed = async () => {
  await connectDB();
  await Category.deleteMany({});
  await Category.insertMany([
    { name: 'Consultation Fee',   type: 'income',  branchId: null },
    { name: 'Prescription Sales', type: 'income',  branchId: null },
    { name: 'OTC Sales',          type: 'income',  branchId: null },
    { name: 'Insurance Claim',    type: 'income',  branchId: null },
    { name: 'Other Income',       type: 'income',  branchId: null },
    { name: 'Rent',               type: 'expense', branchId: null },
    { name: 'Salaries',           type: 'expense', branchId: null },
    { name: 'Utilities',          type: 'expense', branchId: null },
    { name: 'Supplies',           type: 'expense', branchId: null },
    { name: 'Other Expense',      type: 'expense', branchId: null },
  ]);
  console.log('✅ Categories seeded');
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });