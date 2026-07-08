const router = require('express').Router();
const { query } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { getGroupSummary } = require('../controllers/groupController');

/**
 * All routes here are mounted at /api/v1/group (see app.js).
 * Every route is restricted to super_admin.
 */

// GET /api/v1/group/summary
router.get(
  '/summary',
  authenticate,
  authorize('super_admin'),
  [
    query('startDate').optional().isISO8601().withMessage('startDate must be ISO 8601'),
    query('endDate').optional().isISO8601().withMessage('endDate must be ISO 8601'),
    query('preset')
      .optional()
      .isIn(['today', 'week', 'month', 'year'])
      .withMessage('preset must be one of: today, week, month, year'),
    query('activityLimit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('activityLimit must be an integer between 1 and 50'),
  ],
  validate,
  getGroupSummary,
);

module.exports = router;