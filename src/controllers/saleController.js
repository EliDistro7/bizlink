const mongoose = require('mongoose');
const Sale          = require('../models/Sale');
const Product       = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const { writeAuditLog } = require('../utils/auditLogger');
const { success, error } = require('../utils/apiResponse');

// GET /api/v1/branches/:branchId/sales
const listSales = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { page = 1, limit = 20, startDate, endDate, paymentMethod } = req.query;

    const filter = { branchId, isVoided: false };
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (startDate || endDate) {
      filter.transactionDate = {};
      if (startDate) filter.transactionDate.$gte = new Date(startDate);
      if (endDate)   filter.transactionDate.$lte = new Date(endDate);
    }

    const pageNum  = parseInt(page,  10);
    const limitNum = parseInt(limit, 10);

    const [sales, total] = await Promise.all([
      Sale.find(filter).sort({ transactionDate: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
      Sale.countDocuments(filter),
    ]);

    return success(res, { sales, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } });
  } catch (err) {
    console.error('[sales/list]', err);
    return error(res, 'Server error', 500);
  }
};

// POST /api/v1/branches/:branchId/sales
// Body: { items: [{ productId, quantity }], paymentMethod, transactionDate, receiptRef?, notes? }
const createSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { branchId } = req.params;
    const { items, paymentMethod, transactionDate, receiptRef, notes } = req.body;
    const { userId } = req.user;

    // 1. Load all products in one query
    const productIds = items.map(i => i.productId);
    const products   = await Product.find({ _id: { $in: productIds }, branchId, isActive: true }).session(session);

    if (products.length !== productIds.length) {
      await session.abortTransaction();
      return error(res, 'One or more products not found or inactive in this branch', 404);
    }

    const productMap = Object.fromEntries(products.map(p => [p._id.toString(), p]));

    // 2. Validate stock availability and build sale items
    const saleItems = [];
    let totalAmount = 0;

    for (const item of items) {
      const product = productMap[item.productId];
      if (!product) {
        await session.abortTransaction();
        return error(res, `Product ${item.productId} not found`, 404);
      }
      if (product.stockQuantity < item.quantity) {
        await session.abortTransaction();
        return error(res, `Insufficient stock for "${product.name}". Available: ${product.stockQuantity}`, 400);
      }
      const lineTotal = product.sellingPrice * item.quantity;
      totalAmount += lineTotal;
      saleItems.push({
        productId:   product._id,
        productName: product.name,
        quantity:    item.quantity,
        unitPrice:   product.sellingPrice,
        lineTotal,
      });
    }

    // 3. Create the sale document
    const [sale] = await Sale.create(
      [{ branchId, items: saleItems, totalAmount, paymentMethod, transactionDate, receiptRef, notes, recordedBy: userId }],
      { session }
    );

    // 4. Decrement stock and write movement records for each line item
    const movementDocs = [];
    for (const item of items) {
      const product = productMap[item.productId];
      const newStock = product.stockQuantity - item.quantity;

      await Product.updateOne({ _id: product._id }, { $inc: { stockQuantity: -item.quantity } }, { session });

      movementDocs.push({
        branchId,
        productId:     product._id,
        type:          'sale',
        quantityDelta: -item.quantity,
        stockAfter:    newStock,
        referenceId:   sale._id,
        recordedBy:    userId,
      });
    }
    await StockMovement.insertMany(movementDocs, { session });

    await session.commitTransaction();

    writeAuditLog({
      action: 'create', collection: 'sales',
      documentId: sale._id, actor: userId,
      branchId, after: sale.toObject(), ip: req.ip,
    });

    return success(res, { sale }, 201);
  } catch (err) {
    await session.abortTransaction();
    console.error('[sales/create]', err);
    return error(res, 'Server error', 500);
  } finally {
    session.endSession();
  }
};

// GET /api/v1/branches/:branchId/sales/:saleId
const getSale = async (req, res) => {
  try {
    const { branchId, saleId } = req.params;
    const sale = await Sale.findOne({ _id: saleId, branchId });
    if (!sale) return error(res, 'Sale not found', 404);
    return success(res, { sale });
  } catch (err) {
    console.error('[sales/get]', err);
    return error(res, 'Server error', 500);
  }
};

// DELETE /api/v1/branches/:branchId/sales/:saleId  (void — restores stock)
const voidSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { branchId, saleId } = req.params;
    const { voidReason } = req.body;
    const { userId } = req.user;

    const sale = await Sale.findOne({ _id: saleId, branchId }).session(session);
    if (!sale)         { await session.abortTransaction(); return error(res, 'Sale not found', 404); }
    if (sale.isVoided) { await session.abortTransaction(); return error(res, 'Sale is already voided', 400); }

    const before = sale.toObject();
    sale.isVoided  = true;
    sale.voidReason = voidReason;
    await sale.save({ session });

    // Restore stock and record void movements
    const movementDocs = [];
    for (const item of sale.items) {
      const product = await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { stockQuantity: item.quantity } },
        { new: true, session }
      );
      movementDocs.push({
        branchId,
        productId:     item.productId,
        type:          'void',
        quantityDelta: +item.quantity,
        stockAfter:    product.stockQuantity,
        referenceId:   sale._id,
        notes:         `Void of sale ${sale._id}`,
        recordedBy:    userId,
      });
    }
    await StockMovement.insertMany(movementDocs, { session });

    await session.commitTransaction();

    writeAuditLog({
      action: 'void', collection: 'sales',
      documentId: sale._id, actor: userId,
      branchId, reason: voidReason, before, after: sale.toObject(), ip: req.ip,
    });

    return success(res, { sale });
  } catch (err) {
    await session.abortTransaction();
    console.error('[sales/void]', err);
    return error(res, 'Server error', 500);
  } finally {
    session.endSession();
  }
};

module.exports = { listSales, createSale, getSale, voidSale };