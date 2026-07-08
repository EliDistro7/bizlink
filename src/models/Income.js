const mongoose = require('mongoose');

const incomeSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    paymentMethod: {
      type: String,
      enum: ['cash', 'mobile_money', 'card', 'insurance'],
      required: true,
    },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiptRef: { type: String, default: null },
    notes: { type: String, default: null },
    isVoided: { type: Boolean, default: false },
    voidReason: { type: String, default: null },
    transactionDate: { type: Date, required: true },
  },
  { timestamps: true }
);

// Compound index for efficient date-range queries per branch (§10 performance)
incomeSchema.index({ branchId: 1, transactionDate: -1 });
incomeSchema.index({ branchId: 1, isVoided: 1, transactionDate: -1 });

module.exports = mongoose.model('Income', incomeSchema);