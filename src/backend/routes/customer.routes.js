const router = require('express').Router({ mergeParams: true });
const { authenticate, authorize, scopeBranch } = require('../middleware/auth');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { listCustomers, createCustomer, updateCustomer, deactivateCustomer } = require('../controllers/customerController');

const branchParam   = param('branchId').isMongoId();
const customerParam = param('id').isMongoId();

// GET /api/v1/branches/:branchId/customers
router.get('/:branchId/customers',
  authenticate, scopeBranch,
  [
    branchParam,
    query('search').optional().trim(),
    query('isActive').optional().isIn(['true', 'false', 'all']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 200 }),
  ],
  validate, listCustomers
);

// POST /api/v1/branches/:branchId/customers
router.post('/:branchId/customers',
  authenticate, authorize('super_admin', 'branch_manager', 'cashier'), scopeBranch,
  [
    branchParam,
    body('name').notEmpty().trim(),
    body('phone').notEmpty().trim(),
    body('email').optional({ nullable: true }).trim().isEmail(),
    body('address').optional({ nullable: true }).trim(),
    body('notes').optional({ nullable: true }).trim(),
  ],
  validate, createCustomer
);

// PATCH /api/v1/customers/:id
router.patch('/customers/:id',
  authenticate, authorize('super_admin', 'branch_manager', 'cashier'),
  [
    customerParam,
    body('name').optional().trim(),
    body('phone').optional().trim(),
    body('email').optional({ nullable: true }).trim().isEmail(),
    body('address').optional({ nullable: true }).trim(),
    body('notes').optional({ nullable: true }).trim(),
    body('isActive').optional().isBoolean(),
  ],
  validate, updateCustomer
);

// DELETE /api/v1/customers/:id  (soft deactivate)
router.delete('/customers/:id',
  authenticate, authorize('super_admin', 'branch_manager', 'cashier'),
  [customerParam],
  validate, deactivateCustomer
);

module.exports = router;
