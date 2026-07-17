// src/routes/credit.action.routes.js
// Mounted at /api/v1/credits → handles /:id/payment and PATCH /:id
const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { recordPayment, updateCredit } = require('../controllers/creditController');

const creditParam = param('id').isMongoId();

// POST /api/v1/credits/:id/payment
router.post(
  '/:id/payment',
  authenticate,
  authorize('super_admin', 'branch_manager', 'cashier'),
  [
    creditParam,
    body('amountPaid').isFloat({ min: 0.01 }),
    body('notes').optional().trim(),
  ],
  validate,
  recordPayment
);

// PATCH /api/v1/credits/:id
router.patch(
  '/:id',
  authenticate,
  authorize('super_admin', 'branch_manager', 'cashier'),
  [
    creditParam,
    body('description').optional().trim(),
    body('notes').optional().trim(),
    body('dueDate').optional().isISO8601(),
  ],
  validate,
  updateCredit
);

module.exports = router;
