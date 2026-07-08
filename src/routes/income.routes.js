
//src/routes/income.routes.js << 'EOF'
const router = require('express').Router({ mergeParams: true });
const { authenticate, authorize, scopeBranch } = require('../middleware/auth');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const {
  listIncomes,
  createIncome,
  getIncome,
  updateIncome,
  voidIncome,
} = require('../controllers/incomeController');

const branchParam = param('branchId').isMongoId();
const incomeParam = param('incomeId').isMongoId();

// GET /api/v1/branches/:branchId/incomes
router.get('/:branchId/incomes',
  authenticate,
  scopeBranch,
  branchParam,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('period').optional().isIn(['today', 'this_week', 'this_month', 'this_quarter']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('categoryId').optional().isMongoId(),
    query('paymentMethod').optional().isIn(['cash', 'mobile_money', 'card', 'insurance']),
  ],
  validate,
  listIncomes
);

// POST /api/v1/branches/:branchId/incomes
router.post('/:branchId/incomes',
  authenticate,
  scopeBranch,
  [
    branchParam,
    body('amount').isFloat({ min: 0 }),
    body('categoryId').isMongoId(),
    body('paymentMethod').isIn(['cash', 'mobile_money', 'card', 'insurance']),
    body('transactionDate').isISO8601(),
    body('receiptRef').optional().trim(),
    body('notes').optional().trim(),
  ],
  validate,
  createIncome
);

// GET /api/v1/branches/:branchId/incomes/:incomeId
router.get('/:branchId/incomes/:incomeId',
  authenticate,
  scopeBranch,
  [branchParam, incomeParam],
  validate,
  getIncome
);

// PATCH /api/v1/branches/:branchId/incomes/:incomeId
router.patch('/:branchId/incomes/:incomeId',
  authenticate,
  authorize('super_admin', 'branch_manager'),
  scopeBranch,
  [
    branchParam,
    incomeParam,
    body('amount').optional().isFloat({ min: 0 }),
    body('categoryId').optional().isMongoId(),
    body('paymentMethod').optional().isIn(['cash', 'mobile_money', 'card', 'insurance']),
    body('transactionDate').optional().isISO8601(),
    body('receiptRef').optional().trim(),
    body('notes').optional().trim(),
  ],
  validate,
  updateIncome
);

// DELETE /api/v1/branches/:branchId/incomes/:incomeId  (void)
router.delete('/:branchId/incomes/:incomeId',
  authenticate,
  authorize('super_admin', 'branch_manager'),
  scopeBranch,
  [
    branchParam,
    incomeParam,
    body('voidReason').notEmpty().trim(),
  ],
  validate,
  voidIncome
);

module.exports = router;

