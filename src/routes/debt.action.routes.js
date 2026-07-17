// src/routes/debt.action.routes.js
// Mounted at /api/v1/debts → handles /:id/payment and PATCH /:id
const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { recordPayment, updateDebt } = require('../controllers/debtController');

const debtParam = param('id').isMongoId();

// POST /api/v1/debts/:id/payment
router.post(
  '/:id/payment',
  authenticate,
  authorize('super_admin', 'branch_manager', 'cashier'),
  [
    debtParam,
    body('amountPaid').isFloat({ min: 0.01 }),
    body('notes').optional().trim(),
  ],
  validate,
  recordPayment
);

// PATCH /api/v1/debts/:id
router.patch(
  '/:id',
  authenticate,
  authorize('super_admin', 'branch_manager', 'cashier'),
  [
    debtParam,
    body('description').optional().trim(),
    body('notes').optional().trim(),
    body('dueDate').optional().isISO8601(),
  ],
  validate,
  updateDebt
);

module.exports = router;
