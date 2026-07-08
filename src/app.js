const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const branchRoutes = require('./routes/branch.routes');
const userRoutes = require('./routes/user.routes');
const incomeRoutes = require('./routes/income.routes');
const expenseRoutes = require('./routes/expense.routes');
const reportRoutes = require('./routes/report.routes');
const groupRoutes = require('./routes/group.routes');       // ← new
const adminIncomeRoutes = require('./routes/admin.income.routes');
const categoryRoutes = require('./routes/category.routes');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const adminExpenseRoutes = require('./routes/admin.expense.routes');

const app = express();

// ── Security ─────────────────────────────────────────────
app.use(helmet());

app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// ── Parsers ───────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Logging ───────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// ── Health check ──────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

// ── API Routes ────────────────────────────────────────────
const API = '/api/v1';

app.use(`${API}/auth`,     authRoutes);
app.use(`${API}/users`,    userRoutes);
app.use(`${API}/branches`, branchRoutes);
app.use(`${API}/branches`, incomeRoutes);   // /api/v1/branches/:branchId/incomes
app.use(`${API}/branches`, expenseRoutes);  // /api/v1/branches/:branchId/expenses
app.use(`${API}/reports`,  reportRoutes);   // /api/v1/reports/group/* and /api/v1/reports/branch/*
app.use(`${API}/group`,    groupRoutes);    // /api/v1/group/summary  ← new
app.use(`${API}/admin`, adminIncomeRoutes);  // /api/v1/admin/incomes
app.use(`${API}/categories`, categoryRoutes);
app.use(`${API}/admin`, adminExpenseRoutes);  // ← backticks

// ── Error handling ────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;