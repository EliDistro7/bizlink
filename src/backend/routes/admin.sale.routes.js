// src/routes/admin.sale.routes.js
const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('express-validator');
const validate = require('../middleware/validate');
const Sale = require('../models/Sale');
const { success, error } = require('../utils/apiResponse');

// GET /api/v1/admin/sales  (super_admin only — all branches)
router.get('/sales',
  authenticate,
  authorize('super_admin'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('branchId').optional().isMongoId(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('paymentMethod').optional()
      .isIn(['cash', 'mobile_money', 'card', 'insurance']),
  ],
  validate,
  async (req, res) => {
    try {
      const {
        page = 1, limit = 50,
        branchId, startDate, endDate, paymentMethod,
      } = req.query;

      const filter = { isVoided: false };
      if (branchId)      filter.branchId      = branchId;
      if (paymentMethod) filter.paymentMethod = paymentMethod;
      if (startDate || endDate) {
        filter.transactionDate = {};
        if (startDate) filter.transactionDate.$gte = new Date(startDate);
        if (endDate)   filter.transactionDate.$lte = new Date(endDate);
      }

      const pageNum  = parseInt(page,  10);
      const limitNum = parseInt(limit, 10);

      const [sales, total] = await Promise.all([
        Sale.find(filter)
          .sort({ transactionDate: -1 })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum),
        Sale.countDocuments(filter),
      ]);

      return success(res, {
        sales,
        pagination: { page: pageNum, limit: limitNum, total,
                      pages: Math.ceil(total / limitNum) },
      });
    } catch (err) {
      console.error('[admin/sales/list]', err);
      return error(res, 'Server error', 500);
    }
  }
);

module.exports = router;