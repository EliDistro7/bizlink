// src/routes/admin.product.routes.js
const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('express-validator');
const validate = require('../middleware/validate');
const Product = require('../models/Product');
const { success, error } = require('../utils/apiResponse');

// GET /api/v1/admin/products  (super_admin only — all branches)
router.get('/products',
  authenticate,
  authorize('super_admin'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 200 }),
    query('branchId').optional().isMongoId(),
    query('search').optional().trim(),
    query('lowStock').optional().isBoolean(),
    query('isActive').optional().isIn(['true', 'false', 'all']),
  ],
  validate,
  async (req, res) => {
    try {
      const {
        page = 1, limit = 200,
        branchId, search, lowStock, isActive = 'true',
      } = req.query;

      const filter = {};
      if (branchId) filter.branchId = branchId;
      if (isActive !== 'all') filter.isActive = isActive === 'true';
      if (search) filter.name = { $regex: search, $options: 'i' };
      if (lowStock === 'true') {
        filter.$expr = { $lte: ['$stockQuantity', '$lowStockThreshold'] };
      }

      const pageNum  = parseInt(page,  10);
      const limitNum = parseInt(limit, 10);

      const [products, total] = await Promise.all([
        Product.find(filter)
          .sort({ name: 1 })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum),
        Product.countDocuments(filter),
      ]);

      return success(res, {
        products,
        pagination: { page: pageNum, limit: limitNum, total,
                      pages: Math.ceil(total / limitNum) },
      });
    } catch (err) {
      console.error('[admin/products/list]', err);
      return error(res, 'Server error', 500);
    }
  }
);

module.exports = router;