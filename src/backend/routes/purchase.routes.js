const router = require('express').Router({ mergeParams: true });
const { authenticate, authorize, scopeBranch } = require('../middleware/auth');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { listPurchases, createPurchase, getPurchase, voidPurchase } = require('../controllers/purchaseController');

const branchParam   = param('branchId').isMongoId();
const purchaseParam = param('purchaseId').isMongoId();

const purchaseItemBody = [
  body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
  body('items.*.productId').isMongoId(),
  body('items.*.quantity').isInt({ min: 1 }),
  body('items.*.unitCost').optional().isFloat({ min: 0 }),
];

// GET /api/v1/branches/:branchId/purchases
router.get('/:branchId/purchases',
  authenticate, scopeBranch,
  [
    branchParam,
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  validate, listPurchases
);

// POST /api/v1/branches/:branchId/purchases  (manager+ only)
router.post('/:branchId/purchases',
  authenticate, authorize('super_admin', 'branch_manager'), scopeBranch,
  [
    branchParam,
    ...purchaseItemBody,
    body('purchaseDate').isISO8601(),
    body('supplier').optional().trim(),
    body('invoiceRef').optional().trim(),
    body('notes').optional().trim(),
  ],
  validate, createPurchase
);

// GET /api/v1/branches/:branchId/purchases/:purchaseId
router.get('/:branchId/purchases/:purchaseId',
  authenticate, scopeBranch,
  [branchParam, purchaseParam], validate, getPurchase
);

// DELETE /api/v1/branches/:branchId/purchases/:purchaseId  (void)
router.delete('/:branchId/purchases/:purchaseId',
  authenticate, authorize('super_admin', 'branch_manager'), scopeBranch,
  [branchParam, purchaseParam, body('voidReason').notEmpty().trim()],
  validate, voidPurchase
);

module.exports = router;