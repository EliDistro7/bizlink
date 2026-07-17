// src/routes/admin.credit.routes.js
// Mounted at /api/v1/admin → handles /credits (super_admin cross-branch view)
const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('express-validator');
const validate = require('../middleware/validate');
const Credit   = require('../models/Credit');
const { success, error } = require('../utils/apiResponse');

// GET /api/v1/admin/credits
router.get(
  '/credits',
  authenticate,
  authorize('super_admin'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    query('branchId').optional().isMongoId(),
    query('status')
      .optional()
      .custom((value) => {
        const allowed = ['unpaid', 'partial', 'paid'];
        const parts = value.split(',').map((s) => s.trim());
        if (parts.every((p) => allowed.includes(p))) return true;
        throw new Error(`status must be one or more of: ${allowed.join(', ')}`);
      }),
    query('customerId').optional().isMongoId(),
    query('search').optional().trim(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  validate,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        branchId,
        status,
        customerId,
        search,
        startDate,
        endDate,
      } = req.query;

      const filter = {};
      if (branchId)   filter.branchId   = branchId;
      if (status) {
        const statuses = status.split(',').map((s) => s.trim()).filter(Boolean);
        filter.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
      }
      if (customerId) filter.customerId = customerId;

      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate)   filter.createdAt.$lte = new Date(endDate);
      }

      const pageNum  = parseInt(page,  10);
      const limitNum = parseInt(limit, 10);

      let [credits, total, totals] = await Promise.all([
        Credit.find(filter)
          .populate('branchId', 'name')
          .populate('customerId', 'name phone')
          .sort({ createdAt: -1 })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum),
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
            (c.customerId?.name  && rx.test(c.customerId.name)) ||
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
      console.error('[admin/credits/list]', err);
      return error(res, 'Server error', 500);
    }
  }
);

module.exports = router;