const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    payee: { type: String, trim: true, default: null },
    paymentMethod: {
      type: String,
      enum: ['cash', 'mobile_money', 'card', 'cheque'],
      required: true,
    },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // set once a Branch Manager approves a cashier-submitted expense
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    receiptImageUrl: { type: String, default: null },
    notes: { type: String, default: null },
    isRecurring: { type: Boolean, default: false },
    recurringPeriod: { type: String, enum: ['weekly', 'monthly', null], default: null },
    // pending = awaiting manager approval; approved = posted; rejected = declined
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved',
    },
    isVoided: { type: Boolean, default: false },
    voidReason: { type: String, default: null },
    transactionDate: { type: Date, required: true },
  },
  { timestamps: true }
);

expenseSchema.index({ branchId: 1, transactionDate: -1 });
expenseSchema.index({ branchId: 1, isVoided: 1, transactionDate: -1 });

module.exports = mongoose.model('Expense', expenseSchema);