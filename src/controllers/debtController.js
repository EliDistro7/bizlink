const Debt = require('../models/Debt');
const { writeAuditLog } = require('../utils/auditLogger');
const { success, error } = require('../utils/apiResponse');

// ─────────────────────────────────────────────────────────
// GET /api/v1/branches/:branchId/debts
// ─────────────────────────────────────────────────────────
const listDebts = async (req, res) => {
  try {
    const { branchId } = req.params;
    const {
      page = 1,
      limit = 20,
      status,
      customerId,
      search,
      startDate,
      endDate,
    } = req.query;

    const filter = { branchId };

    if (status)     filter.status     = status;
    if (customerId) filter.customerId = customerId;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate)   filter.createdAt.$lte = new Date(endDate);
    }

    // Search by customer name or phone
    if (search && search.trim()) {
      const rx = new RegExp(search.trim(), 'i');
      filter.$or = [{ customerName: rx }, { customerPhone: rx }];
    }

    const pageNum  = parseInt(page,  10);
    const limitNum = parseInt(limit, 10);

    const [debts, total, totals] = await Promise.all([
      Debt.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Debt.countDocuments(filter),
      // Aggregate summary totals for the banner
      Debt.aggregate([
        { $match: { ...filter } },
        {
          $group: {
            _id: null,
            totalOwed: { $sum: '$amount' },
            totalPaid: { $sum: '$amountPaid' },
          },
        },
      ]),
    ]);

    const { totalOwed = 0, totalPaid = 0 } = totals[0] ?? {};

    return success(res, {
      debts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
      totalOwed,
      totalPaid,
    });
  } catch (err) {
    console.error('[debts/list]', err);
    return error(res, 'Server error', 500);
  }
};

// ─────────────────────────────────────────────────────────
// POST /api/v1/branches/:branchId/debts
// ─────────────────────────────────────────────────────────
const createDebt = async (req, res) => {
  try {
    const { branchId } = req.params;
    const {
      customerId,
      customerName,
      customerPhone,
      amount,
      dueDate,
      description,
      notes,
    } = req.body;

    const debt = await Debt.create({
      branchId,
      customerId,
      customerName,
      customerPhone,
      amount,
      dueDate,
      description: description ?? null,
      notes: notes ?? null,
      recordedBy: req.user.userId,
    });

    writeAuditLog({
      action: 'create',
      collection: 'debts',
      documentId: debt._id,
      actor: req.user.userId,
      branchId,
      after: debt.toObject(),
      ip: req.ip,
    });

    return success(res, { debt }, 201);
  } catch (err) {
    console.error('[debts/create]', err);
    return error(res, 'Server error', 500);
  }
};

// ─────────────────────────────────────────────────────────
// POST /api/v1/debts/:id/payment
// ─────────────────────────────────────────────────────────
const recordPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amountPaid, notes } = req.body;

    const debt = await Debt.findById(id);
    if (!debt) return error(res, 'Debt record not found', 404);

    if (debt.status === 'paid') {
      return error(res, 'This debt has already been fully paid', 400);
    }

    const before = debt.toObject();

    debt.amountPaid = Math.min(debt.amountPaid + amountPaid, debt.amount);
    if (notes) debt.notes = notes;

    await debt.save(); // pre-save hook updates status + paidAt

    writeAuditLog({
      action: 'payment',
      collection: 'debts',
      documentId: debt._id,
      actor: req.user.userId,
      branchId: debt.branchId,
      before,
      after: debt.toObject(),
      ip: req.ip,
    });

    return success(res, { debt });
  } catch (err) {
    console.error('[debts/payment]', err);
    return error(res, 'Server error', 500);
  }
};

// ─────────────────────────────────────────────────────────
// PATCH /api/v1/debts/:id
// ─────────────────────────────────────────────────────────
const updateDebt = async (req, res) => {
  try {
    const { id } = req.params;
    const { description, notes, dueDate } = req.body;

    const debt = await Debt.findById(id);
    if (!debt) return error(res, 'Debt record not found', 404);

    if (debt.status === 'paid') {
      return error(res, 'Cannot edit a fully paid debt', 400);
    }

    const before = debt.toObject();

    if (description !== undefined) debt.description = description;
    if (notes       !== undefined) debt.notes       = notes;
    if (dueDate     !== undefined) debt.dueDate     = new Date(dueDate);

    await debt.save();

    writeAuditLog({
      action: 'edit',
      collection: 'debts',
      documentId: debt._id,
      actor: req.user.userId,
      branchId: debt.branchId,
      before,
      after: debt.toObject(),
      ip: req.ip,
    });

    return success(res, { debt });
  } catch (err) {
    console.error('[debts/update]', err);
    return error(res, 'Server error', 500);
  }
};

module.exports = { listDebts, createDebt, recordPayment, updateDebt };
