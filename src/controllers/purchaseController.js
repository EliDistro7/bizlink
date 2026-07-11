const mongoose = require('mongoose');
const Purchase      = require('../models/Purchase');
const Product       = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const { writeAuditLog } = require('../utils/auditLogger');
const { success, error } = require('../utils/apiResponse');

// GET /api/v1/branches/:branchId/purchases
const listPurchases = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { page = 1, limit = 20, startDate, endDate } = req.query;

    const filter = { branchId, isVoided: false };
    if (startDate || endDate) {
      filter.purchaseDate = {};
      if (startDate) filter.purchaseDate.$gte = new Date(startDate);
      if (endDate)   filter.purchaseDate.$lte = new Date(endDate);
    }

    const pageNum  = parseInt(page,  10);
    const limitNum = parseInt(limit, 10);

    const [purchases, total] = await Promise.all([
      Purchase.find(filter).sort({ purchaseDate: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
      Purchase.countDocuments(filter),
    ]);

    return success(res, { purchases, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } });
  } catch (err) {
    console.error('[purchases/list]', err);
    return error(res, 'Server error', 500);
  }
};

// POST /api/v1/branches/:branchId/purchases
// Body: { items: [{ productId, quantity, unitCost }], supplier?, invoiceRef?, purchaseDate, notes? }
const createPurchase = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { branchId } = req.params;
    const { items, supplier, invoiceRef, purchaseDate, notes } = req.body;
    const { userId } = req.user;

    const productIds = items.map(i => i.productId);
    const products   = await Product.find({ _id: { $in: productIds }, branchId, isActive: true }).session(session);

    if (products.length !== productIds.length) {
      await session.abortTransaction();
      return error(res, 'One or more products not found or inactive in this branch', 404);
    }

    const productMap = Object.fromEntries(products.map(p => [p._id.toString(), p]));

    const purchaseItems = [];
    let totalCost = 0;

    for (const item of items) {
      const product  = productMap[item.productId];
      const unitCost  = item.unitCost ?? product.costPrice;
      const lineTotal = unitCost * item.quantity;
      totalCost += lineTotal;
      purchaseItems.push({
        productId:   product._id,
        productName: product.name,
        quantity:    item.quantity,
        unitCost,
        lineTotal,
      });
    }

    const [purchase] = await Purchase.create(
      [{ branchId, items: purchaseItems, totalCost, supplier, invoiceRef, purchaseDate, notes, recordedBy: userId }],
      { session }
    );

    const movementDocs = [];
    for (const item of items) {
      const product  = productMap[item.productId];
      const newStock = product.stockQuantity + item.quantity;

      await Product.updateOne({ _id: product._id }, { $inc: { stockQuantity: item.quantity } }, { session });

      movementDocs.push({
        branchId,
        productId:     product._id,
        type:          'purchase',
        quantityDelta: +item.quantity,
        stockAfter:    newStock,
        referenceId:   purchase._id,
        notes:         supplier ? `Supplier: ${supplier}` : null,
        recordedBy:    userId,
      });
    }
    await StockMovement.insertMany(movementDocs, { session });

    await session.commitTransaction();

    writeAuditLog({
      action: 'create', collection: 'purchases',
      documentId: purchase._id, actor: userId,
      branchId, after: purchase.toObject(), ip: req.ip,
    });

    return success(res, { purchase }, 201);
  } catch (err) {
    await session.abortTransaction();
    console.error('[purchases/create]', err);
    return error(res, 'Server error', 500);
  } finally {
    session.endSession();
  }
};

// GET /api/v1/branches/:branchId/purchases/:purchaseId
const getPurchase = async (req, res) => {
  try {
    const { branchId, purchaseId } = req.params;
    const purchase = await Purchase.findOne({ _id: purchaseId, branchId });
    if (!purchase) return error(res, 'Purchase not found', 404);
    return success(res, { purchase });
  } catch (err) {
    console.error('[purchases/get]', err);
    return error(res, 'Server error', 500);
  }
};

// DELETE /api/v1/branches/:branchId/purchases/:purchaseId  (void — decrements stock back)
const voidPurchase = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { branchId, purchaseId } = req.params;
    const { voidReason } = req.body;
    const { userId } = req.user;

    const purchase = await Purchase.findOne({ _id: purchaseId, branchId }).session(session);
    if (!purchase)         { await session.abortTransaction(); return error(res, 'Purchase not found', 404); }
    if (purchase.isVoided) { await session.abortTransaction(); return error(res, 'Purchase is already voided', 400); }

    // Check each product still has enough stock to reverse
    for (const item of purchase.items) {
      const product = await Product.findById(item.productId).session(session);
      if (!product || product.stockQuantity < item.quantity) {
        await session.abortTransaction();
        return error(res, `Cannot void: stock for "${item.productName}" has already been sold`, 400);
      }
    }

    const before = purchase.toObject();
    purchase.isVoided   = true;
    purchase.voidReason = voidReason;
    await purchase.save({ session });

    const movementDocs = [];
    for (const item of purchase.items) {
      const product = await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { stockQuantity: -item.quantity } },
        { new: true, session }
      );
      movementDocs.push({
        branchId,
        productId:     item.productId,
        type:          'adjustment',
        quantityDelta: -item.quantity,
        stockAfter:    product.stockQuantity,
        referenceId:   purchase._id,
        notes:         `Void of purchase ${purchase._id}`,
        recordedBy:    userId,
      });
    }
    await StockMovement.insertMany(movementDocs, { session });

    await session.commitTransaction();

    writeAuditLog({
      action: 'void', collection: 'purchases',
      documentId: purchase._id, actor: userId,
      branchId, reason: voidReason, before, after: purchase.toObject(), ip: req.ip,
    });

    return success(res, { purchase });
  } catch (err) {
    await session.abortTransaction();
    console.error('[purchases/void]', err);
    return error(res, 'Server error', 500);
  } finally {
    session.endSession();
  }
};

module.exports = { listPurchases, createPurchase, getPurchase, voidPurchase };