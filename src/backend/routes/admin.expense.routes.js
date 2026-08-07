// src/routes/admin.expense.routes.js
const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('express-validator');
const validate = require('../middleware/validate');
const Expense = require('../models/Expense');
const { success, error } = require('../utils/apiResponse');

// GET /api/v1/admin/expenses
router.get('/expenses',
  authenticate,
  authorize('super_admin'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('branchId').optional().isMongoId(),
    query('status').optional().isIn(['pending', 'approved', 'rejected']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('paymentMethod').optional()
      .isIn(['cash', 'mobile_money', 'card', 'cheque']),
  ],
  validate,
  async (req, res) => {
    try {
      const { page = 1, limit = 20, branchId,
              status, startDate, endDate, paymentMethod } = req.query;

      const filter = { isVoided: false };
      if (branchId)      filter.branchId      = branchId;
      if (status)        filter.status        = status;
      if (paymentMethod) filter.paymentMethod = paymentMethod;
      if (startDate || endDate) {
        filter.transactionDate = {};
        if (startDate) filter.transactionDate.$gte = new Date(startDate);
        if (endDate)   filter.transactionDate.$lte = new Date(endDate);
      }

      const pageNum  = parseInt(page,  10);
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
        pagination: { page: pageNum, limit: limitNum, total,
                      pages: Math.ceil(total / limitNum) },
      });
    } catch (err) {
      console.error('[admin/expenses/list]', err);
      return error(res, 'Server error', 500);
    }
  }
);

module.exports = router;