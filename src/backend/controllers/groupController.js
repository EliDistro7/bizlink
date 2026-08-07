const mongoose = require('mongoose');
const Income = require('../models/Income');
const Expense = require('../models/Expense');
const Branch = require('../models/Branch');
const { resolveDateRange } = require('../utils/dateRange');
const { success, error } = require('../utils/apiResponse');

/**
 * GET /api/v1/group/summary
 *
 * Returns the aggregate snapshot consumed by GroupDashboardScreen:
 * {
 *   totalIncome:        number,
 *   totalExpenses:      number,
 *   netBalance:         number,
 *   activeBranches:     number,
 *   totalBranches:      number,
 *   period:             { startDate, endDate },
 *   recentActivities:   ActivityItem[]
 * }
 *
 * ActivityItem:
 * {
 *   _id:         string,
 *   type:        'income' | 'expense',
 *   description: string,          // category name
 *   amount:      number,
 *   branchName:  string,
 *   createdAt:   ISOString
 * }
 *
 * Accepts the same ?startDate / ?endDate / ?preset query params as
 * resolveDateRange so the Flutter client can scope the numbers.
 * Defaults to the current calendar month.
 *
 * Access: super_admin only (enforced in group.routes.js).
 */
const getGroupSummary = async (req, res) => {
  try {
    const dateRange = resolveDateRange(req.query);
    const { startDate, endDate } = dateRange;
    const ACTIVITY_LIMIT = parseInt(req.query.activityLimit, 10) || 10;

    // ── 1. Branch counts ──────────────────────────────────────────────────
    const [totalBranches, activeBranches] = await Promise.all([
      Branch.countDocuments({}),
      Branch.countDocuments({ isActive: true }),
    ]);

    // ── 2. Group-wide P&L via aggregation (single pass each) ─────────────
    const dateMatch = { $gte: startDate, $lte: endDate };

    const [incomeAgg, expenseAgg] = await Promise.all([
      Income.aggregate([
        {
          $match: {
            isVoided: false,
            transactionDate: dateMatch,
          },
        },
        {
          $group: { _id: null, total: { $sum: '$amount' } },
        },
      ]),
      Expense.aggregate([
        {
          $match: {
            isVoided: false,
            status: 'approved',
            transactionDate: dateMatch,
          },
        },
        {
          $group: { _id: null, total: { $sum: '$amount' } },
        },
      ]),
    ]);

    const totalIncome = incomeAgg[0]?.total ?? 0;
    const totalExpenses = expenseAgg[0]?.total ?? 0;

    // ── 3. Recent activity feed ───────────────────────────────────────────
    // Fetch the N most-recent income + expense records, merge, sort by date,
    // take top ACTIVITY_LIMIT. Two parallel queries; no cross-collection
    // aggregation needed because we only need a small slice.

    const [recentIncomes, recentExpenses] = await Promise.all([
      Income.find({ isVoided: false })
        .sort({ transactionDate: -1 })
        .limit(ACTIVITY_LIMIT)
        .populate('branchId', 'name')
        .populate('categoryId', 'name')
        .lean(),
      Expense.find({ isVoided: false, status: 'approved' })
        .sort({ transactionDate: -1 })
        .limit(ACTIVITY_LIMIT)
        .populate('branchId', 'name')
        .populate('categoryId', 'name')
        .lean(),
    ]);

    // Normalise to a shared ActivityItem shape
    const toActivity = (doc, type) => ({
      _id: doc._id.toString(),
      type,
      // Use category name as the human-readable description; fall back
      // to notes or a generic label if the category wasn't populated.
      description: doc.categoryId?.name ?? doc.notes ?? (type === 'income' ? 'Income' : 'Expense'),
      amount: doc.amount,
      branchName: doc.branchId?.name ?? 'Unknown branch',
      createdAt: doc.transactionDate.toISOString(),
    });

    const activities = [
      ...recentIncomes.map((d) => toActivity(d, 'income')),
      ...recentExpenses.map((d) => toActivity(d, 'expense')),
    ]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, ACTIVITY_LIMIT);

    // ── 4. Respond ────────────────────────────────────────────────────────
    return success(res, {
      period: { startDate, endDate },
      totalIncome,
      totalExpenses,
      netBalance: totalIncome - totalExpenses,
      totalBranches,
      activeBranches,
      recentActivities: activities,
    });
  } catch (err) {
    console.error('[group/summary]', err);
    return error(res, 'Server error', 500);
  }
};

module.exports = { getGroupSummary };