const router = require('express').Router({ mergeParams: true });
const { authenticate, scopeBranch } = require('../middleware/auth');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { listSales, createSale, getSale, voidSale } = require('../controllers/saleController');

const branchParam = param('branchId').isMongoId();
const saleParam   = param('saleId').isMongoId();

const saleItemBody = [
  body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
  body('items.*.productId').isMongoId(),
  body('items.*.quantity').isInt({ min: 1 }),
];

// GET /api/v1/branches/:branchId/sales
router.get('/:branchId/sales',
  authenticate, scopeBranch,
  [
    branchParam,
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('paymentMethod').optional().isIn(['cash', 'mobile_money', 'card', 'insurance']),
  ],
  validate, listSales
);

// POST /api/v1/branches/:branchId/sales
router.post('/:branchId/sales',
  authenticate, scopeBranch,
  [
    branchParam,
    ...saleItemBody,
    body('paymentMethod').isIn(['cash', 'mobile_money', 'card', 'insurance']),
    body('transactionDate').isISO8601(),
    body('receiptRef').optional().trim(),
    body('notes').optional().trim(),
  ],
  validate, createSale
);

// GET /api/v1/branches/:branchId/sales/:saleId
router.get('/:branchId/sales/:saleId',
  authenticate, scopeBranch,
  [branchParam, saleParam], validate, getSale
);

// DELETE /api/v1/branches/:branchId/sales/:saleId  (void)
router.delete('/:branchId/sales/:saleId',
  authenticate, scopeBranch,
  [branchParam, saleParam, body('voidReason').notEmpty().trim()],
  validate, voidSale
);

module.exports = router;