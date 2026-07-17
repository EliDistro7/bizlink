const mongoose = require('mongoose');

const debtSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },

    // Customer snapshot — stored inline (no separate Customer collection)
    customerId:    { type: String, required: true, trim: true, index: true },
    customerName:  { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true },

    /** Total amount owed */
    amount: { type: Number, required: true, min: 0 },

    /** Cumulative payments received so far */
    amountPaid: { type: Number, default: 0, min: 0 },

    dueDate: { type: Date, required: true },

    /**
     * Derived status — kept as a stored field so we can index/filter it.
     * Recomputed on every save via pre('save') hook.
     * Values: 'unpaid' | 'partial' | 'paid'
     */
    status: {
      type: String,
      enum: ['unpaid', 'partial', 'paid'],
      default: 'unpaid',
      index: true,
    },

    description: { type: String, trim: true, default: null },
    notes:       { type: String, trim: true, default: null },

    /** Set when status transitions to 'paid' */
    paidAt: { type: Date, default: null },

    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// ── Compound indexes ──────────────────────────────────────
debtSchema.index({ branchId: 1, createdAt: -1 });
debtSchema.index({ branchId: 1, status: 1, createdAt: -1 });
debtSchema.index({ branchId: 1, customerId: 1 });

// ── Computed virtual ──────────────────────────────────────
debtSchema.virtual('amountRemaining').get(function () {
  return this.amount - this.amountPaid;
});

// ── Status sync hook ──────────────────────────────────────
debtSchema.pre('save', function (next) {
  if (this.amountPaid <= 0) {
    this.status = 'unpaid';
    this.paidAt = null;
  } else if (this.amountPaid >= this.amount) {
    this.amountPaid = this.amount; // clamp to total
    this.status = 'paid';
    if (!this.paidAt) this.paidAt = new Date();
  } else {
    this.status = 'partial';
    this.paidAt = null;
  }
  next();
});

module.exports = mongoose.model('Debt', debtSchema);
