// src/routes/admin.customer.routes.js
const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('express-validator');
const validate = require('../middleware/validate');
const Customer = require('../models/Customer');
const { success, error } = require('../utils/apiResponse');

// GET /api/v1/admin/customers  (super_admin only — all branches)
router.get('/customers',
  authenticate,
  authorize('super_admin'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 200 }),
    query('branchId').optional().isMongoId(),
    query('search').optional().trim(),
    query('isActive').optional().isIn(['true', 'false', 'all']),
  ],
  validate,
  async (req, res) => {
    try {
      const { page = 1, limit = 20, branchId, search, isActive = 'true' } = req.query;

      const filter = {};
      if (branchId) filter.branchId = branchId;
      if (isActive !== 'all') filter.isActive = isActive === 'true';
      if (search) {
        filter.$or = [
          { name:  { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
        ];
      }

      const pageNum  = parseInt(page,  10);
      const limitNum = parseInt(limit, 10);

      const [customers, total] = await Promise.all([
        Customer.find(filter)
          .populate('branchId', 'name')
          .sort({ name: 1 })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum),
        Customer.countDocuments(filter),
      ]);

      return success(res, {
        customers,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      });
    } catch (err) {
      console.error('[admin/customers/list]', err);
      return error(res, 'Server error', 500);
    }
  }
);

module.exports = router;
