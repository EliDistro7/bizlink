// src/routes/admin.purchase.routes.js
const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('express-validator');
const validate = require('../middleware/validate');
const Purchase = require('../models/Purchase');
const { success, error } = require('../utils/apiResponse');

// GET /api/v1/admin/purchases  (super_admin only — all branches)
router.get('/purchases',
  authenticate,
  authorize('super_admin'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('branchId').optional().isMongoId(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  validate,
  async (req, res) => {
    try {
      const {
        page = 1, limit = 50,
        branchId, startDate, endDate,
      } = req.query;

      const filter = { isVoided: false };
      if (branchId) filter.branchId = branchId;
      if (startDate || endDate) {
        filter.purchaseDate = {};
        if (startDate) filter.purchaseDate.$gte = new Date(startDate);
        if (endDate)   filter.purchaseDate.$lte = new Date(endDate);
      }

      const pageNum  = parseInt(page,  10);
      const limitNum = parseInt(limit, 10);

      const [purchases, total] = await Promise.all([
        Purchase.find(filter)
          .sort({ purchaseDate: -1 })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum),
        Purchase.countDocuments(filter),
      ]);

      return success(res, {
        purchases,
        pagination: { page: pageNum, limit: limitNum, total,
                      pages: Math.ceil(total / limitNum) },
      });
    } catch (err) {
      console.error('[admin/purchases/list]', err);
      return error(res, 'Server error', 500);
    }
  }
);

module.exports = router;