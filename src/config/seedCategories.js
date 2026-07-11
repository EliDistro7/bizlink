// scripts/seedCategories.js
require('dotenv').config();

if (process.env.NODE_ENV === 'production') {
  console.error('❌ Refusing to seed in production');
  process.exit(1);
}

const connectDB = require('./db');
const Category = require('../models/Category');

const CATEGORIES = [
  { name: 'Consultation Fee', type: 'income',  branchId: null },
  { name: 'Sales',            type: 'income',  branchId: null },
  { name: 'Insurance Claim',  type: 'income',  branchId: null },
  { name: 'Other Income',     type: 'income',  branchId: null },
  { name: 'Rent',             type: 'expense', branchId: null },
  { name: 'Salaries',         type: 'expense', branchId: null },
  { name: 'Utilities',        type: 'expense', branchId: null },
  { name: 'Supplies',         type: 'expense', branchId: null },
  { name: 'Other Expense',    type: 'expense', branchId: null },
];

const seed = async () => {
  await connectDB();

  const ops = CATEGORIES.map(({ name, type, branchId }) => ({
    updateOne: {
      filter: { name, type, branchId },
      update: { $setOnInsert: { name, type, branchId, isActive: true } },
      upsert: true,
    },
  }));

  const result = await Category.bulkWrite(ops, { ordered: false });

  console.log(
    `✅ Categories seeded — inserted: ${result.upsertedCount}, matched: ${result.matchedCount}`
  );
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });