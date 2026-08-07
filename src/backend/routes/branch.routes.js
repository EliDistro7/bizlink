//src/routes/branch.routes.js << 'EOF'
const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const {
  listBranches,
  createBranch,
  getBranch,
  updateBranch,
} = require('../controllers/branchController');

router.get('/',
  authenticate,
  authorize('super_admin'),
  listBranches
);

router.post('/',
  authenticate,
  authorize('super_admin'),
  [
    body('name').notEmpty().trim(),
    body('location').optional().trim(),
    body('contactPhone').optional().trim(),
  ],
  validate,
  createBranch
);

router.get('/:id',
  authenticate,
  param('id').isMongoId(),
  validate,
  getBranch
);

router.patch('/:id',
  authenticate,
  authorize('super_admin'),
  [
    param('id').isMongoId(),
    body('name').optional().notEmpty().trim(),
    body('location').optional().trim(),
    body('contactPhone').optional().trim(),
    body('isActive').optional().isBoolean(),
  ],
  validate,
  updateBranch
);

module.exports = router;
