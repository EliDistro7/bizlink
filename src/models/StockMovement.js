const mongoose = require('mongoose');

// Every change to a product's stock quantity is recorded here.
// 'sale'     → quantity sold (decreases stock), linked to a Sale doc
// 'purchase' → restock / supplier delivery (increases stock)
// 'adjustment' → manual correction by a manager (positive or negative delta)
// 'void'     → reversal of an earlier sale (increases stock back)

const stockMovementSchema = new mongoose.Schema(
  {
    branchId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Branch',   required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product',  required: true, index: true },
    type: {
      type: String,
      enum: ['sale', 'purchase', 'adjustment', 'void'],
      required: true,
    },
    // Positive = stock added; negative = stock removed
    quantityDelta: { type: Number, required: true },
    // Snapshot of stock level after this movement applied
    stockAfter:    { type: Number, required: true },

    referenceId:   { type: mongoose.Schema.Types.ObjectId, default: null }, // Sale._id or Purchase._id
    notes:         { type: String, default: null },
    recordedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

stockMovementSchema.index({ productId: 1, createdAt: -1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);