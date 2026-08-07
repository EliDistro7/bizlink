


const router = require('express').Router({ mergeParams: true });
const { authenticate, authorize, scopeBranch } = require('../middleware/auth');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { listProducts, createProduct, getProduct, updateProduct } = require('../controllers/productController');

const branchParam  = param('branchId').isMongoId();
const productParam = param('productId').isMongoId();

// GET /api/v1/branches/:branchId/products
router.get('/:branchId/products',
  authenticate, scopeBranch,
  [
    branchParam,
    query('search').optional().trim(),
    query('lowStock').optional().isBoolean(),
    query('isActive').optional().isIn(['true', 'false', 'all']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 200 }),
  ],
  validate, listProducts
);

// POST /api/v1/branches/:branchId/products  (manager or super_admin only)
router.post('/:branchId/products',
  authenticate, authorize('super_admin', 'branch_manager'), scopeBranch,
  [
    branchParam,
    body('name').notEmpty().trim(),
    body('sellingPrice').isFloat({ min: 0 }),
    body('sku').optional().trim(),
    body('unit').optional().trim(),
    body('costPrice').optional().isFloat({ min: 0 }),
    body('stockQuantity').optional().isFloat({ min: 0 }),
    body('lowStockThreshold').optional().isFloat({ min: 0 }),
  ],
  validate, createProduct
);

// GET /api/v1/branches/:branchId/products/:productId
router.get('/:branchId/products/:productId',
  authenticate, scopeBranch,
  [branchParam, productParam], validate, getProduct
);

// PATCH /api/v1/branches/:branchId/products/:productId  (manager or super_admin only)
router.patch('/:branchId/products/:productId',
  authenticate, authorize('super_admin', 'branch_manager'), scopeBranch,
  [
    branchParam, productParam,
    body('name').optional().trim(),
    body('sku').optional().trim(),
    body('unit').optional().trim(),
    body('sellingPrice').optional().isFloat({ min: 0 }),
    body('costPrice').optional().isFloat({ min: 0 }),
    body('lowStockThreshold').optional().isFloat({ min: 0 }),
    body('isActive').optional().isBoolean(),
  ],
  validate, updateProduct
);

module.exports = router;