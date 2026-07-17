const Credit   = require('../models/Credit');
const Customer = require('../models/Customer');
const { writeAuditLog } = require('../utils/auditLogger');
const { success, error } = require('../utils/apiResponse');

// ─────────────────────────────────────────────────────────
// GET /api/v1/branches/:branchId/credits
// ─────────────────────────────────────────────────────────
const listCredits = async (req, res) => {
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

    const pageNum  = parseInt(page,  10);
    const limitNum = parseInt(limit, 10);

    // Build base query — populate customer for name/phone
    let query = Credit.find(filter)
      .populate('customerId', 'name phone')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    // If searching, we need to filter after populate or use aggregation.
    // For simplicity: fetch first, then post-filter (limit is low).
    // For large datasets, consider $lookup in aggregate instead.
    let [credits, total, totals] = await Promise.all([
      query,
      Credit.countDocuments(filter),
      Credit.aggregate([
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

    // Apply search post-populate
    if (search && search.trim()) {
      const rx = new RegExp(search.trim(), 'i');
      credits = credits.filter(
        (c) =>
          (c.customerId?.name && rx.test(c.customerId.name)) ||
          (c.customerId?.phone && rx.test(c.customerId.phone))
      );
    }

    const { totalOwed = 0, totalPaid = 0 } = totals[0] ?? {};

    return success(res, {
      credits,
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
    console.error('[credits/list]', err);
    return error(res, 'Server error', 500);
  }
};

// ─────────────────────────────────────────────────────────
// POST /api/v1/branches/:branchId/credits
// ─────────────────────────────────────────────────────────
const createCredit = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { customerId, amount, dueDate, description, notes } = req.body;

    // Verify the customer belongs to this branch
    const customer = await Customer.findById(customerId);
    if (!customer) return error(res, 'Customer not found', 404);
    if (String(customer.branchId) !== String(branchId)) {
      return error(res, 'Customer does not belong to this branch', 400);
    }

    const credit = await Credit.create({
      branchId,
      customerId,
      amount,
      dueDate,
      description: description ?? null,
      notes: notes ?? null,
      recordedBy: req.user.userId,
    });

    const populated = await credit.populate('customerId', 'name phone');

    writeAuditLog({
      action: 'create',
      collection: 'credits',
      documentId: credit._id,
      actor: req.user.userId,
      branchId,
      after: credit.toObject(),
      ip: req.ip,
    });

    return success(res, { credit: populated }, 201);
  } catch (err) {
    console.error('[credits/create]', err);
    return error(res, 'Server error', 500);
  }
};

// ─────────────────────────────────────────────────────────
// POST /api/v1/credits/:id/payment
// ─────────────────────────────────────────────────────────
const recordPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amountPaid, notes } = req.body;

    const credit = await Credit.findById(id).populate('customerId', 'name phone');
    if (!credit) return error(res, 'Credit record not found', 404);

    if (credit.status === 'paid') {
      return error(res, 'This credit has already been fully paid', 400);
    }

    const before = credit.toObject();

    credit.amountPaid = Math.min(credit.amountPaid + amountPaid, credit.amount);
    if (notes) credit.notes = notes;

    await credit.save(); // pre-save hook updates status + paidAt

    writeAuditLog({
      action: 'payment',
      collection: 'credits',
      documentId: credit._id,
      actor: req.user.userId,
      branchId: credit.branchId,
      before,
      after: credit.toObject(),
      ip: req.ip,
    });

    return success(res, { credit });
  } catch (err) {
    console.error('[credits/payment]', err);
    return error(res, 'Server error', 500);
  }
};

// ─────────────────────────────────────────────────────────
// PATCH /api/v1/credits/:id
// ─────────────────────────────────────────────────────────
const updateCredit = async (req, res) => {
  try {
    const { id } = req.params;
    const { description, notes, dueDate } = req.body;

    const credit = await Credit.findById(id).populate('customerId', 'name phone');
    if (!credit) return error(res, 'Credit record not found', 404);

    if (credit.status === 'paid') {
      return error(res, 'Cannot edit a fully paid credit', 400);
    }

    const before = credit.toObject();

    if (description !== undefined) credit.description = description;
    if (notes       !== undefined) credit.notes       = notes;
    if (dueDate     !== undefined) credit.dueDate     = new Date(dueDate);

    await credit.save();

    writeAuditLog({
      action: 'edit',
      collection: 'credits',
      documentId: credit._id,
      actor: req.user.userId,
      branchId: credit.branchId,
      before,
      after: credit.toObject(),
      ip: req.ip,
    });

    return success(res, { credit });
  } catch (err) {
    console.error('[credits/update]', err);
    return error(res, 'Server error', 500);
  }
};

module.exports = { listCredits, createCredit, recordPayment, updateCredit };
