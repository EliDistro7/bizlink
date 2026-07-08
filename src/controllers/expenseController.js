const Expense = require('../models/Expense');
const { writeAuditLog } = require('../utils/auditLogger');
const { success, error } = require('../utils/apiResponse');

// GET /api/v1/branches/:branchId/expenses
const listExpenses = async (req, res) => {
  try {
    const { branchId } = req.params;
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate,
      categoryId,
      paymentMethod,
      status,
    } = req.query;

    const filter = { branchId };
    if (categoryId) filter.categoryId = categoryId;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.transactionDate = {};
      if (startDate) filter.transactionDate.$gte = new Date(startDate);
      if (endDate) filter.transactionDate.$lte = new Date(endDate);
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const [expenses, total] = await Promise.all([
      Expense.find(filter)
        .sort({ transactionDate: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Expense.countDocuments(filter),
    ]);

    return success(res, {
      expenses,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('[expenses/list]', err);
    return error(res, 'Server error', 500);
  }
};

// POST /api/v1/branches/:branchId/expenses
// Cashier-submitted expenses above a threshold go to 'pending' for Branch
// Manager approval (§4.1.2 "Pending Approvals"); Branch Manager/Super Admin
// submissions post directly as 'approved'.
const EXPENSE_APPROVAL_THRESHOLD = parseInt(process.env.EXPENSE_APPROVAL_THRESHOLD, 10) || 100000;

const createExpense = async (req, res) => {
  try {
    const { branchId } = req.params;
    const {
      amount,
      categoryId,
      payee,
      paymentMethod,
      transactionDate,
      notes,
      receiptImageUrl,
      isRecurring,
      recurringPeriod,
    } = req.body;

    const { role, userId } = req.user;
    const needsApproval = role === 'cashier' && amount >= EXPENSE_APPROVAL_THRESHOLD;

    const expense = await Expense.create({
      branchId,
      amount,
      categoryId,
      payee,
      paymentMethod,
      transactionDate,
      notes,
      receiptImageUrl,
      isRecurring,
      recurringPeriod,
      recordedBy: userId,
      status: needsApproval ? 'pending' : 'approved',
      approvedBy: needsApproval ? null : userId,
    });

    writeAuditLog({
      action: 'create',
      collection: 'expenses',
      documentId: expense._id,
      actor: userId,
      branchId,
      after: expense.toObject(),
      ip: req.ip,
    });

    return success(res, { expense }, 201);
  } catch (err) {
    console.error('[expenses/create]', err);
    return error(res, 'Server error', 500);
  }
};

// GET /api/v1/branches/:branchId/expenses/:expenseId
const getExpense = async (req, res) => {
  try {
    const { branchId, expenseId } = req.params;

    const expense = await Expense.findOne({ _id: expenseId, branchId });
    if (!expense) return error(res, 'Expense record not found', 404);

    return success(res, { expense });
  } catch (err) {
    console.error('[expenses/get]', err);
    return error(res, 'Server error', 500);
  }
};

// PATCH /api/v1/branches/:branchId/expenses/:expenseId
const updateExpense = async (req, res) => {
  try {
    const { branchId, expenseId } = req.params;
    const {
      amount,
      categoryId,
      payee,
      paymentMethod,
      transactionDate,
      notes,
      receiptImageUrl,
      isRecurring,
      recurringPeriod,
      status,
    } = req.body;

    const expense = await Expense.findOne({ _id: expenseId, branchId });
    if (!expense) return error(res, 'Expense record not found', 404);

    if (expense.isVoided) {
      return error(res, 'Cannot edit a voided expense record', 400);
    }

    const before = expense.toObject();

    if (amount !== undefined) expense.amount = amount;
    if (categoryId !== undefined) expense.categoryId = categoryId;
    if (payee !== undefined) expense.payee = payee;
    if (paymentMethod !== undefined) expense.paymentMethod = paymentMethod;
    if (transactionDate !== undefined) expense.transactionDate = transactionDate;
    if (notes !== undefined) expense.notes = notes;
    if (receiptImageUrl !== undefined) expense.receiptImageUrl = receiptImageUrl;
    if (isRecurring !== undefined) expense.isRecurring = isRecurring;
    if (recurringPeriod !== undefined) expense.recurringPeriod = recurringPeriod;

    if (status !== undefined) {
      expense.status = status;
      if (status === 'approved') expense.approvedBy = req.user.userId;
    }

    await expense.save();

    writeAuditLog({
      action: status !== undefined && status === 'approved' ? 'approve'
            : status !== undefined && status === 'rejected' ? 'reject'
            : 'edit',
      collection: 'expenses',
      documentId: expense._id,
      actor: req.user.userId,
      branchId,
      before,
      after: expense.toObject(),
      ip: req.ip,
    });

    return success(res, { expense });
  } catch (err) {
    console.error('[expenses/update]', err);
    return error(res, 'Server error', 500);
  }
};

// DELETE /api/v1/branches/:branchId/expenses/:expenseId  (void, reason required)
const voidExpense = async (req, res) => {
  try {
    const { branchId, expenseId } = req.params;
    const { voidReason } = req.body;

    const expense = await Expense.findOne({ _id: expenseId, branchId });
    if (!expense) return error(res, 'Expense record not found', 404);

    if (expense.isVoided) {
      return error(res, 'Expense record is already voided', 400);
    }

    const before = expense.toObject();

    expense.isVoided = true;
    expense.voidReason = voidReason;
    await expense.save();

    writeAuditLog({
      action: 'void',
      collection: 'expenses',
      documentId: expense._id,
      actor: req.user.userId,
      branchId,
      reason: voidReason,
      before,
      after: expense.toObject(),
      ip: req.ip,
    });

    return success(res, { expense });
  } catch (err) {
    console.error('[expenses/void]', err);
    return error(res, 'Server error', 500);
  }
};

module.exports = { listExpenses, createExpense, getExpense, updateExpense, voidExpense };