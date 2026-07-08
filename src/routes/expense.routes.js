
// src/routes/expense.routes.js 
const router = require('express').Router({ mergeParams: true });
const { authenticate, authorize, scopeBranch } = require('../middleware/auth');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const {
  listExpenses,
  createExpense,
  getExpense,
  updateExpense,
  voidExpense,
} = require('../controllers/expenseController');

const branchParam = param('branchId').isMongoId();
const expenseParam = param('expenseId').isMongoId();

// GET /api/v1/branches/:branchId/expenses
router.get('/:branchId/expenses',
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
    query('paymentMethod').optional().isIn(['cash', 'mobile_money', 'card', 'cheque']),
    query('status').optional().isIn(['pending', 'approved', 'rejected']),
  ],
  validate,
  listExpenses
);

// POST /api/v1/branches/:branchId/expenses
router.post('/:branchId/expenses',
  authenticate,
  scopeBranch,
  [
    branchParam,
    body('amount').isFloat({ min: 0 }),
    body('categoryId').isMongoId(),
    body('paymentMethod').isIn(['cash', 'mobile_money', 'card', 'cheque']),
    body('transactionDate').isISO8601(),
    body('payee').optional().trim(),
    body('notes').optional().trim(),
    body('receiptImageUrl').optional().isURL(),
    body('isRecurring').optional().isBoolean(),
    body('recurringPeriod').optional().isIn(['weekly', 'monthly']),
  ],
  validate,
  createExpense
);

// GET /api/v1/branches/:branchId/expenses/:expenseId
router.get('/:branchId/expenses/:expenseId',
  authenticate,
  scopeBranch,
  [branchParam, expenseParam],
  validate,
  getExpense
);

// PATCH /api/v1/branches/:branchId/expenses/:expenseId
router.patch('/:branchId/expenses/:expenseId',
  authenticate,
  authorize('super_admin', 'branch_manager'),
  scopeBranch,
  [
    branchParam,
    expenseParam,
    body('amount').optional().isFloat({ min: 0 }),
    body('categoryId').optional().isMongoId(),
    body('paymentMethod').optional().isIn(['cash', 'mobile_money', 'card', 'cheque']),
    body('transactionDate').optional().isISO8601(),
    body('payee').optional().trim(),
    body('notes').optional().trim(),
    body('receiptImageUrl').optional().isURL(),
    body('isRecurring').optional().isBoolean(),
    body('recurringPeriod').optional().isIn(['weekly', 'monthly']),
    body('status').optional().isIn(['pending', 'approved', 'rejected']),
  ],
  validate,
  updateExpense
);

// DELETE /api/v1/branches/:branchId/expenses/:expenseId  (void)
router.delete('/:branchId/expenses/:expenseId',
  authenticate,
  authorize('super_admin', 'branch_manager'),
  scopeBranch,
  [
    branchParam,
    expenseParam,
    body('voidReason').notEmpty().trim(),
  ],
  validate,
  voidExpense
);

module.exports = router;
