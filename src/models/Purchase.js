const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema(
  {
    productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },   // snapshot
    quantity:    { type: Number, required: true, min: 1 },
    unitCost:    { type: Number, required: true, min: 0 },
    lineTotal:   { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const purchaseSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    items:        { type: [purchaseItemSchema], required: true, validate: v => v.length > 0 },
    totalCost:    { type: Number, required: true, min: 0 },
    supplier:     { type: String, trim: true, default: null },
    invoiceRef:   { type: String, trim: true, default: null },
    notes:        { type: String, default: null },
    purchaseDate: { type: Date, required: true },
    recordedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isVoided:     { type: Boolean, default: false },
    voidReason:   { type: String, default: null },
  },
  { timestamps: true }
);

purchaseSchema.index({ branchId: 1, purchaseDate: -1 });

module.exports = mongoose.model('Purchase', purchaseSchema);