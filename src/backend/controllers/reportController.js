const mongoose = require('mongoose');
const Income = require('../models/Income');
const Expense = require('../models/Expense');
const Branch = require('../models/Branch');
const Credit = require('../models/Credit');
const Debt   = require('../models/Debt');
const { resolveDateRange } = require('../utils/dateRange');
const { success, error } = require('../utils/apiResponse');

// ─── helpers ──────────────────────────────────────────────────────────────────

const toMap = (aggResult, field = 'total') =>
  Object.fromEntries(aggResult.map((r) => [r._id.toString(), r[field]]));

const toOid = (id) => mongoose.Types.ObjectId.createFromHexString(id);

const calcPnl = async (branchObjectId, dateRange) => {
  const dateMatch = { $gte: dateRange.startDate, $lte: dateRange.endDate };

  const [incomeAgg, expenseAgg] = await Promise.all([
    Income.aggregate([
      {
        $match: {
          branchId: branchObjectId,
          isVoided: false,
          transactionDate: dateMatch,
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Expense.aggregate([
      {
        $match: {
          branchId: branchObjectId,
          isVoided: false,
          status: 'approved',
          transactionDate: dateMatch,
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  const totalIncome   = incomeAgg[0]?.total   ?? 0;
  const totalExpenses = expenseAgg[0]?.total   ?? 0;
  return { totalIncome, totalExpenses, netProfit: totalIncome - totalExpenses };
};

// ─── Branch-scoped reports (/api/v1/reports/branch/:branchId/...) ─────────────

/**
 * GET /api/v1/reports/branch/:branchId/summary
 */
const branchSummary = async (req, res) => {
  try {
    const { branchId } = req.params;
    const dateRange  = resolveDateRange(req.query);
    const branchOid  = toOid(branchId);

    const [pnl, pendingCount] = await Promise.all([
      calcPnl(branchOid, dateRange),
      Expense.countDocuments({ branchId: branchOid, status: 'pending', isVoided: false }),
    ]);

    return success(res, {
      branchId,
      period: { startDate: dateRange.startDate, endDate: dateRange.endDate },
      ...pnl,
      pendingExpensesCount: pendingCount,
    });
  } catch (err) {
    console.error('[reports/branch/summary]', err.message, err.stack);
    return error(res, 'Server error', 500);
  }
};

/**
 * GET /api/v1/reports/branch/:branchId/income-by-category
 */
const branchIncomeByCategory = async (req, res) => {
  try {
    const { branchId } = req.params;
    const dateRange = resolveDateRange(req.query);

    const agg = await Income.aggregate([
      {
        $match: {
          branchId: toOid(branchId),
          isVoided: false,
          transactionDate: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        },
      },
      { $group: { _id: '$categoryId', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      { $sort: { total: -1 } },
      {
        $project: {
          _id: 0,
          categoryId: '$_id',
          categoryName: '$category.name',
          total: 1,
          count: 1,
        },
      },
    ]);

    return success(res, {
      branchId,
      period: { startDate: dateRange.startDate, endDate: dateRange.endDate },
      breakdown: agg,
    });
  } catch (err) {
    console.error('[reports/branch/income-by-category]', err.message, err.stack);
    return error(res, 'Server error', 500);
  }
};

/**
 * GET /api/v1/reports/branch/:branchId/expense-by-category
 */
const branchExpenseByCategory = async (req, res) => {
  try {
    const { branchId } = req.params;
    const dateRange = resolveDateRange(req.query);

    const agg = await Expense.aggregate([
      {
        $match: {
          branchId: toOid(branchId),
          isVoided: false,
          status: 'approved',
          transactionDate: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        },
      },
      { $group: { _id: '$categoryId', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      { $sort: { total: -1 } },
      {
        $project: {
          _id: 0,
          categoryId: '$_id',
          categoryName: '$category.name',
          total: 1,
          count: 1,
        },
      },
    ]);

    return success(res, {
      branchId,
      period: { startDate: dateRange.startDate, endDate: dateRange.endDate },
      breakdown: agg,
    });
  } catch (err) {
    console.error('[reports/branch/expense-by-category]', err.message, err.stack);
    return error(res, 'Server error', 500);
  }
};

/**
 * GET /api/v1/reports/branch/:branchId/daily-totals
 */
const branchDailyTotals = async (req, res) => {
  try {
    const { branchId } = req.params;
    const dateRange  = resolveDateRange(req.query);
    const branchOid  = toOid(branchId);
    const dateMatch  = { $gte: dateRange.startDate, $lte: dateRange.endDate };

    const dateGroup = {
      year:  { $year:       '$transactionDate' },
      month: { $month:      '$transactionDate' },
      day:   { $dayOfMonth: '$transactionDate' },
    };

    const [incomeDaily, expenseDaily] = await Promise.all([
      Income.aggregate([
        { $match: { branchId: branchOid, isVoided: false, transactionDate: dateMatch } },
        { $group: { _id: dateGroup, total: { $sum: '$amount' } } },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]),
      Expense.aggregate([
        { $match: { branchId: branchOid, isVoided: false, status: 'approved', transactionDate: dateMatch } },
        { $group: { _id: dateGroup, total: { $sum: '$amount' } } },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]),
    ]);

    const toDateKey = (r) =>
      `${r._id.year}-${String(r._id.month).padStart(2, '0')}-${String(r._id.day).padStart(2, '0')}`;

    const incomeMap  = toMap(incomeDaily.map((r)  => ({ _id: toDateKey(r),  total: r.total })));
    const expenseMap = toMap(expenseDaily.map((r)  => ({ _id: toDateKey(r),  total: r.total })));

    const allDays = [...new Set([...Object.keys(incomeMap), ...Object.keys(expenseMap)])].sort();
    const days = allDays.map((date) => ({
      date,
      income:   incomeMap[date]  ?? 0,
      expenses: expenseMap[date] ?? 0,
      net:     (incomeMap[date]  ?? 0) - (expenseMap[date] ?? 0),
    }));

    return success(res, {
      branchId,
      period: { startDate: dateRange.startDate, endDate: dateRange.endDate },
      days,
    });
  } catch (err) {
    console.error('[reports/branch/daily-totals]', err.message, err.stack);
    return error(res, 'Server error', 500);
  }
};

/**
 * GET /api/v1/reports/branch/:branchId/pending-expenses
 */
const branchPendingExpenses = async (req, res) => {
  try {
    const { branchId } = req.params;
    const branchOid  = toOid(branchId);
    const { page = 1, limit = 20 } = req.query;

    const pageNum  = parseInt(page,  10);
    const limitNum = parseInt(limit, 10);
    const filter   = { branchId: branchOid, status: 'pending', isVoided: false };

    const [expenses, total] = await Promise.all([
      Expense.find(filter)
        .populate('recordedBy', 'name email')
        .populate('categoryId', 'name')
        .sort({ transactionDate: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Expense.countDocuments(filter),
    ]);

    return success(res, {
      expenses,
      pagination: {
        page:  pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('[reports/branch/pending-expenses]', err.message, err.stack);
    return error(res, 'Server error', 500);
  }
};

// ─── Group-wide reports (/api/v1/reports/group/...) ──────────────────────────

/**
 * GET /api/v1/reports/group/summary
 */
const groupSummary = async (req, res) => {
  try {
    const dateRange = resolveDateRange(req.query);
    const branches  = await Branch.find({ isActive: true }).select('_id name location');

    const results = await Promise.all(
      branches.map(async (branch) => {
        const pnl = await calcPnl(branch._id, dateRange);
        return { branchId: branch._id, name: branch.name, location: branch.location, ...pnl };
      })
    );

    const totals = results.reduce(
      (acc, b) => ({
        totalIncome:   acc.totalIncome   + b.totalIncome,
        totalExpenses: acc.totalExpenses + b.totalExpenses,
        netProfit:     acc.netProfit     + b.netProfit,
      }),
      { totalIncome: 0, totalExpenses: 0, netProfit: 0 }
    );

    return success(res, {
      period: { startDate: dateRange.startDate, endDate: dateRange.endDate },
      totals,
      branches: results,
    });
  } catch (err) {
    console.error('[reports/group/summary]', err.message, err.stack);
    return error(res, 'Server error', 500);
  }
};

/**
 * GET /api/v1/reports/group/pending-expenses
 */
const groupPendingExpenses = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const pageNum  = parseInt(page,  10);
    const limitNum = parseInt(limit, 10);
    const filter   = { status: 'pending', isVoided: false };

    const [expenses, total] = await Promise.all([
      Expense.find(filter)
        .populate('branchId',    'name location')
        .populate('recordedBy',  'name email')
        .populate('categoryId',  'name')
        .sort({ transactionDate: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Expense.countDocuments(filter),
    ]);

    return success(res, {
      expenses,
      pagination: {
        page:  pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('[reports/group/pending-expenses]', err.message, err.stack);
    return error(res, 'Server error', 500);
  }
};

// ─── Obligations helpers ───────────────────────────────────────────────────────

/**
 * Aggregate unpaid/partial credits or debts for a given match filter.
 * Returns { totalOwed, totalCollected, totalOverdue, overdueCount }.
 *
 * Uses a single $facet so we hit the collection once.
 * The 'overdue' bucket counts documents where dueDate < now and status != 'paid'.
 */
const aggregateObligations = async (Model, matchFilter, amountPaidField = 'amountPaid') => {
  const now = new Date();
  const [result] = await Model.aggregate([
    { $match: matchFilter },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              totalOwed:      { $sum: '$amount' },
              totalCollected: { $sum: `$${amountPaidField}` },
            },
          },
        ],
        overdue: [
          {
            $match: {
              dueDate: { $lt: now },
              status:  { $ne: 'paid' },
            },
          },
          {
            $group: {
              _id:          null,
              overdueTotal: { $sum: { $subtract: ['$amount', `$${amountPaidField}`] } },
              overdueCount: { $sum: 1 },
            },
          },
        ],
      },
    },
  ]);

  const t = result?.totals[0]  ?? {};
  const o = result?.overdue[0] ?? {};

  return {
    totalOwed:      t.totalOwed      ?? 0,
    totalCollected: t.totalCollected ?? 0,
    totalOverdue:   o.overdueTotal   ?? 0,
    overdueCount:   o.overdueCount   ?? 0,
  };
};

/**
 * Build per-branch obligation breakdown using a $group on branchId.
 * Returns array sorted descending by abs(netPosition).
 */
const aggregateObligationsByBranch = async (Model, matchFilter, amountPaidField = 'amountPaid') => {
  const now = new Date();
  return Model.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id:       '$branchId',
        remaining: { $sum: { $subtract: ['$amount', `$${amountPaidField}`] } },
        overdue: {
          $sum: {
            $cond: [
              { $and: [{ $lt: ['$dueDate', now] }, { $ne: ['$status', 'paid'] }] },
              { $subtract: ['$amount', `$${amountPaidField}`] },
              0,
            ],
          },
        },
      },
    },
    {
      $lookup: {
        from:         'branches',
        localField:   '_id',
        foreignField: '_id',
        as:           'branch',
      },
    },
    { $unwind: { path: '$branch', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id:        0,
        branchId:   '$_id',
        branchName: '$branch.name',
        remaining:  1,
        overdue:    1,
      },
    },
  ]);
};

// ─── Branch obligations (/api/v1/reports/branch/:branchId/obligations) ─────────

/**
 * GET /api/v1/reports/branch/:branchId/obligations
 *
 * Returns pre-aggregated receivables (credits) and payables (debts)
 * for a single branch — no pagination, no document list.
 * The Flutter client uses these totals directly without fetching raw records.
 */
const branchObligations = async (req, res) => {
  try {
    const { branchId } = req.params;
    const branchOid = toOid(branchId);

    const openFilter = { status: { $in: ['unpaid', 'partial'] } };

    const [credits, debts] = await Promise.all([
      aggregateObligations(Credit, { branchId: branchOid, ...openFilter }),
      aggregateObligations(Debt,   { branchId: branchOid, ...openFilter }),
    ]);

    return success(res, {
      branchId,
      credits: {
        totalOwed:      credits.totalOwed,
        totalCollected: credits.totalCollected,
        totalOverdue:   credits.totalOverdue,
        overdueCount:   credits.overdueCount,
      },
      debts: {
        totalOwed:    debts.totalOwed,
        totalPaid:    debts.totalCollected,
        totalOverdue: debts.totalOverdue,
        overdueCount: debts.overdueCount,
      },
    });
  } catch (err) {
    console.error('[reports/branch/obligations]', err.message, err.stack);
    return error(res, 'Server error', 500);
  }
};

// ─── Group obligations (/api/v1/reports/group/obligations) ────────────────────

/**
 * GET /api/v1/reports/group/obligations
 *
 * Returns group-wide receivables and payables totals, plus a per-branch
 * breakdown — all computed server-side via aggregation.
 * No pagination, no document lists; replaces the client fetching
 * /admin/credits?limit=1000 and /admin/debts?limit=1000.
 */
const groupObligations = async (req, res) => {
  try {
    const openFilter = { status: { $in: ['unpaid', 'partial'] } };

    const [creditTotals, debtTotals, creditsByBranch, debtsByBranch] =
      await Promise.all([
        aggregateObligations(Credit, openFilter),
        aggregateObligations(Debt,   openFilter),
        aggregateObligationsByBranch(Credit, openFilter),
        aggregateObligationsByBranch(Debt,   openFilter),
      ]);

    // Merge per-branch credit and debt rows into a single map keyed by branchId.
    const branchMap = new Map();

    for (const row of creditsByBranch) {
      const key = row.branchId.toString();
      branchMap.set(key, {
        branchId:         key,
        branchName:       row.branchName ?? key,
        creditsRemaining: row.remaining,
        creditsOverdue:   row.overdue,
        debtsRemaining:   0,
        debtsOverdue:     0,
      });
    }

    for (const row of debtsByBranch) {
      const key = row.branchId.toString();
      const existing = branchMap.get(key);
      if (existing) {
        existing.debtsRemaining = row.remaining;
        existing.debtsOverdue   = row.overdue;
      } else {
        branchMap.set(key, {
          branchId:         key,
          branchName:       row.branchName ?? key,
          creditsRemaining: 0,
          creditsOverdue:   0,
          debtsRemaining:   row.remaining,
          debtsOverdue:     row.overdue,
        });
      }
    }

    // Sort by absolute net position descending.
    const byBranch = [...branchMap.values()].sort(
      (a, b) =>
        Math.abs(b.creditsRemaining - b.debtsRemaining) -
        Math.abs(a.creditsRemaining - a.debtsRemaining)
    );

    return success(res, {
      credits: {
        totalOwed:      creditTotals.totalOwed,
        totalCollected: creditTotals.totalCollected,
        totalOverdue:   creditTotals.totalOverdue,
        overdueCount:   creditTotals.overdueCount,
      },
      debts: {
        totalOwed:    debtTotals.totalOwed,
        totalPaid:    debtTotals.totalCollected,
        totalOverdue: debtTotals.totalOverdue,
        overdueCount: debtTotals.overdueCount,
      },
      byBranch,
    });
  } catch (err) {
    console.error('[reports/group/obligations]', err.message, err.stack);
    return error(res, 'Server error', 500);
  }
};

module.exports = {
  branchSummary,
  branchIncomeByCategory,
  branchExpenseByCategory,
  branchDailyTotals,
  branchPendingExpenses,
  branchObligations,
  groupSummary,
  groupPendingExpenses,
  groupObligations,
};