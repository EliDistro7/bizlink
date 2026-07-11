const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    name:        { type: String, required: true, trim: true },
    sku:         { type: String, trim: true, default: null },       // optional barcode / item code
    unit:        { type: String, trim: true, default: 'unit' },     // e.g. "tablet", "bottle", "strip"
    sellingPrice:  { type: Number, required: true, min: 0 },
    costPrice:     { type: Number, default: 0, min: 0 },
    stockQuantity: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 10, min: 0 },       // alert when stock ≤ this
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Fast look-ups: by branch, and by branch+sku (sku unique per branch)
productSchema.index({ branchId: 1, isActive: 1 });
productSchema.index({ branchId: 1, sku: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Product', productSchema);