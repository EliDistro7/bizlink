// src/routes/debt.routes.js
// Mounted at /api/v1/branches → handles /:branchId/debts
const router = require('express').Router({ mergeParams: true });
const { authenticate, authorize, scopeBranch } = require('../middleware/auth');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { listDebts, createDebt } = require('../controllers/debtController');

const branchParam = param('branchId').isMongoId();

// GET /api/v1/branches/:branchId/debts
router.get(
  '/:branchId/debts',
  authenticate,
  scopeBranch,
  [
    branchParam,
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 500 }),
    query('status')
      .optional()
      .custom((value) => {
        const allowed = ['unpaid', 'partial', 'paid'];
        const parts = value.split(',').map((s) => s.trim());
        if (parts.every((p) => allowed.includes(p))) return true;
        throw new Error(`status must be one or more of: ${allowed.join(', ')}`);
      }),
    query('customerId').optional().trim(),
    query('search').optional().trim(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  validate,
  listDebts
);

// POST /api/v1/branches/:branchId/debts
router.post(
  '/:branchId/debts',
  authenticate,
  authorize('super_admin', 'branch_manager', 'cashier'),
  scopeBranch,
  [
    branchParam,
    body('customerId').notEmpty().trim(),
    body('customerName').notEmpty().trim(),
    body('customerPhone').notEmpty().trim(),
    body('amount').isFloat({ min: 0.01 }),
    body('dueDate').isISO8601(),
    body('description').optional().trim(),
    body('notes').optional().trim(),
  ],
  validate,
  createDebt
);

module.exports = router;