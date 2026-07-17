const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    name:    { type: String, required: true, trim: true },
    phone:   { type: String, required: true, trim: true },
    email:   { type: String, trim: true, default: null },
    address: { type: String, trim: true, default: null },
    notes:   { type: String, trim: true, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Fast look-ups: by branch, and by branch+phone (phone unique per branch)
customerSchema.index({ branchId: 1, isActive: 1 });
customerSchema.index({ branchId: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model('Customer', customerSchema);
