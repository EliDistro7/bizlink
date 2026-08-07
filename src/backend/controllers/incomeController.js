const Income = require('../models/Income');
const { writeAuditLog } = require('../utils/auditLogger');
const { success, error } = require('../utils/apiResponse');

// GET /api/v1/branches/:branchId/incomes
const listIncomes = async (req, res) => {
  try {
    const { branchId } = req.params;
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate,
      categoryId,
      paymentMethod,
    } = req.query;

    const filter = { branchId, isVoided: false };
    if (categoryId) filter.categoryId = categoryId;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (startDate || endDate) {
      filter.transactionDate = {};
      if (startDate) filter.transactionDate.$gte = new Date(startDate);
      if (endDate) filter.transactionDate.$lte = new Date(endDate);
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const [incomes, total] = await Promise.all([
      Income.find(filter)
        .sort({ transactionDate: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Income.countDocuments(filter),
    ]);

    return success(res, {
      incomes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('[incomes/list]', err);
    return error(res, 'Server error', 500);
  }
};

// POST /api/v1/branches/:branchId/incomes
const createIncome = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { amount, categoryId, paymentMethod, transactionDate, receiptRef, notes } = req.body;

    const income = await Income.create({
      branchId,
      amount,
      categoryId,
      paymentMethod,
      transactionDate,
      receiptRef,
      notes,
      recordedBy: req.user.userId,
    });

    writeAuditLog({
      action: 'create',
      collection: 'incomes',
      documentId: income._id,
      actor: req.user.userId,
      branchId,
      after: income.toObject(),
      ip: req.ip,
    });

    return success(res, { income }, 201);
  } catch (err) {
    console.error('[incomes/create]', err);
    return error(res, 'Server error', 500);
  }
};

// GET /api/v1/branches/:branchId/incomes/:incomeId
const getIncome = async (req, res) => {
  try {
    const { branchId, incomeId } = req.params;

    const income = await Income.findOne({ _id: incomeId, branchId });
    if (!income) return error(res, 'Income record not found', 404);

    return success(res, { income });
  } catch (err) {
    console.error('[incomes/get]', err);
    return error(res, 'Server error', 500);
  }
};

// PATCH /api/v1/branches/:branchId/incomes/:incomeId
const updateIncome = async (req, res) => {
  try {
    const { branchId, incomeId } = req.params;
    const { amount, categoryId, paymentMethod, transactionDate, receiptRef, notes } = req.body;

    const income = await Income.findOne({ _id: incomeId, branchId });
    if (!income) return error(res, 'Income record not found', 404);

    if (income.isVoided) {
      return error(res, 'Cannot edit a voided income record', 400);
    }

    const before = income.toObject();

    if (amount !== undefined) income.amount = amount;
    if (categoryId !== undefined) income.categoryId = categoryId;
    if (paymentMethod !== undefined) income.paymentMethod = paymentMethod;
    if (transactionDate !== undefined) income.transactionDate = transactionDate;
    if (receiptRef !== undefined) income.receiptRef = receiptRef;
    if (notes !== undefined) income.notes = notes;

    await income.save();

    writeAuditLog({
      action: 'edit',
      collection: 'incomes',
      documentId: income._id,
      actor: req.user.userId,
      branchId,
      before,
      after: income.toObject(),
      ip: req.ip,
    });

    return success(res, { income });
  } catch (err) {
    console.error('[incomes/update]', err);
    return error(res, 'Server error', 500);
  }
};

// DELETE /api/v1/branches/:branchId/incomes/:incomeId  (void, reason required)
const voidIncome = async (req, res) => {
  try {
    const { branchId, incomeId } = req.params;
    const { voidReason } = req.body;

    const income = await Income.findOne({ _id: incomeId, branchId });
    if (!income) return error(res, 'Income record not found', 404);

    if (income.isVoided) {
      return error(res, 'Income record is already voided', 400);
    }

    const before = income.toObject();

    income.isVoided = true;
    income.voidReason = voidReason;
    await income.save();

    writeAuditLog({
      action: 'void',
      collection: 'incomes',
      documentId: income._id,
      actor: req.user.userId,
      branchId,
      reason: voidReason,
      before,
      after: income.toObject(),
      ip: req.ip,
    });

    return success(res, { income });
  } catch (err) {
    console.error('[incomes/void]', err);
    return error(res, 'Server error', 500);
  }
};

module.exports = { listIncomes, createIncome, getIncome, updateIncome, voidIncome };