const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema(
  {
    productId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },   // snapshot at time of sale
    quantity:   { type: Number, required: true, min: 1 },
    unitPrice:  { type: Number, required: true, min: 0 },
    lineTotal:  { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    items:         { type: [saleItemSchema], required: true, validate: v => v.length > 0 },
    totalAmount:   { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ['cash', 'mobile_money', 'card', 'insurance'],
      required: true,
    },
    receiptRef:    { type: String, default: null },
    notes:         { type: String, default: null },
    transactionDate: { type: Date, required: true },
    recordedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isVoided:      { type: Boolean, default: false },
    voidReason:    { type: String, default: null },
  },
  { timestamps: true }
);

saleSchema.index({ branchId: 1, transactionDate: -1 });
saleSchema.index({ branchId: 1, isVoided: 1, transactionDate: -1 });

module.exports = mongoose.model('Sale', saleSchema);