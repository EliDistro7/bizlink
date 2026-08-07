const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query, body } = require('express-validator');
const validate = require('../middleware/validate');
const { listCategories, createCategory } = require('../controllers/categoryController');

// GET /api/v1/categories?type=income&branchId=xxx
router.get('/',
  authenticate,
  [
    query('type').isIn(['income', 'expense']),
    query('branchId').optional().isMongoId(),
  ],
  validate,
  listCategories,
);

// POST /api/v1/categories  (super_admin only)
router.post('/',
  authenticate,
  authorize('super_admin'),
  [
    body('name').notEmpty().trim(),
    body('type').isIn(['income', 'expense']),
    body('branchId').optional().isMongoId(),
  ],
  validate,
  createCategory,
);

module.exports = router;