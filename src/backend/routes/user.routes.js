//src/routes/user.routes.js
const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const {
  listUsers,
  createUser,
  getUser,
  updateUser,
  deactivateUser,
} = require('../controllers/userController');

// Super Admin: all users; Branch Manager: their branch only (enforced in controller)
router.get('/',
  authenticate,
  authorize('super_admin', 'branch_manager'),
  listUsers
);

router.post('/',
  authenticate,
  authorize('super_admin', 'branch_manager'),
  [
    body('name').notEmpty().trim(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('role').isIn(['super_admin', 'branch_manager', 'cashier']),
    body('branchId').optional().isMongoId(),
  ],
  validate,
  createUser
);

router.get('/:id',
  authenticate,
  param('id').isMongoId(),
  validate,
  getUser
);

router.patch('/:id',
  authenticate,
  [
    param('id').isMongoId(),
    body('name').optional().notEmpty().trim(),
    body('email').optional().isEmail().normalizeEmail(),
    body('role').optional().isIn(['super_admin', 'branch_manager', 'cashier']),
    body('branchId').optional().isMongoId(),
    body('isActive').optional().isBoolean(),
  ],
  validate,
  updateUser
);

router.delete('/:id',
  authenticate,
  authorize('super_admin', 'branch_manager'),
  param('id').isMongoId(),
  validate,
  deactivateUser
);

module.exports = router;