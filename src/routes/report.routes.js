const express = require('express');
const router = express.Router();

const {
  branchSummary,
  branchIncomeByCategory,
  branchExpenseByCategory,
  branchDailyTotals,
  branchPendingExpenses,
  groupSummary,
  groupPendingExpenses,
} = require('../controllers/reportController');

const { authenticate, authorize } = require('../middleware/auth');

// ─── Group-wide routes (super_admin only) ─────────────────────────────────────

router.get(
  '/group/summary',
  authenticate,
  authorize('super_admin'),
  groupSummary
);

router.get(
  '/group/pending-expenses',
  authenticate,
  authorize('super_admin'),
  groupPendingExpenses
);

// ─── Branch-scoped routes ─────────────────────────────────────────────────────
// super_admin can access any branch; branch_manager and cashier are restricted
// to their own branch — enforce that check inside the controller or a guard middleware.

router.get(
  '/branch/:branchId/summary',
  authenticate,
  authorize('super_admin', 'branch_manager', 'cashier'),
  branchSummary
);

router.get(
  '/branch/:branchId/income-by-category',
  authenticate,
  authorize('super_admin', 'branch_manager', 'cashier'),
  branchIncomeByCategory
);

router.get(
  '/branch/:branchId/expense-by-category',
  authenticate,
  authorize('super_admin', 'branch_manager', 'cashier'),
  branchExpenseByCategory
);

router.get(
  '/branch/:branchId/daily-totals',
  authenticate,
  authorize('super_admin', 'branch_manager', 'cashier'),
  branchDailyTotals
);

router.get(
  '/branch/:branchId/pending-expenses',
  authenticate,
  authorize('super_admin', 'branch_manager'),
  branchPendingExpenses
);

module.exports = router;