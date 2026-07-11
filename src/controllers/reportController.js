const mongoose = require('mongoose');
const Income = require('../models/Income');
const Expense = require('../models/Expense');
const Branch = require('../models/Branch');
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

module.exports = {
  branchSummary,
  branchIncomeByCategory,
  branchExpenseByCategory,
  branchDailyTotals,
  branchPendingExpenses,
  groupSummary,
  groupPendingExpenses,
};