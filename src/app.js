const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes         = require('./routes/auth.routes');
const branchRoutes       = require('./routes/branch.routes');
const userRoutes         = require('./routes/user.routes');
const incomeRoutes       = require('./routes/income.routes');
const expenseRoutes      = require('./routes/expense.routes');
const reportRoutes       = require('./routes/report.routes');
const groupRoutes        = require('./routes/group.routes');
const adminIncomeRoutes  = require('./routes/admin.income.routes');
const categoryRoutes     = require('./routes/category.routes');
const adminExpenseRoutes = require('./routes/admin.expense.routes');
const adminSaleRoutes    = require('./routes/admin.sale.routes');
const adminPurchaseRoutes = require('./routes/admin.purchase.routes');
const adminProductRoutes  = require('./routes/admin.product.routes');

const creditRoutes       = require('./routes/credit.routes');
const creditActionRoutes = require('./routes/credit.action.routes');
const adminCreditRoutes  = require('./routes/admin.credit.routes');

const debtRoutes       = require('./routes/debt.routes');
const debtActionRoutes = require('./routes/debt.action.routes');
const adminDebtRoutes  = require('./routes/admin.debt.routes');

const customerRoutes      = require('./routes/customer.routes');
const adminCustomerRoutes = require('./routes/admin.customer.routes');

// ── Inventory ────────────────────────────────────────────
const productRoutes  = require('./routes/product.routes');
const saleRoutes     = require('./routes/sale.routes');
const purchaseRoutes = require('./routes/purchase.routes');

const errorHandler = require('./middleware/errorHandler');
const notFound     = require('./middleware/notFound');

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
}));

app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

const API = '/api/v1';

app.use(`${API}/auth`,       authRoutes);
app.use(`${API}/users`,      userRoutes);
app.use(`${API}/branches`,   branchRoutes);
app.use(`${API}/branches`,   incomeRoutes);
app.use(`${API}/branches`,   expenseRoutes);
app.use(`${API}/reports`,    reportRoutes);
app.use(`${API}/group`,      groupRoutes);
app.use(`${API}/admin`,      adminIncomeRoutes);
app.use(`${API}/categories`, categoryRoutes);
app.use(`${API}/admin`,      adminExpenseRoutes);
// ── Inventory ────────────────────────────────────────────
app.use(`${API}/branches`,   productRoutes);
app.use(`${API}/branches`,   saleRoutes);
app.use(`${API}/branches`,   purchaseRoutes);
app.use(`${API}/admin`,      adminSaleRoutes);
app.use(`${API}/admin`,      adminPurchaseRoutes);
app.use(`${API}/admin`,      adminProductRoutes);
app.use(`${API}/branches`,   customerRoutes);
app.use(`${API}/admin`,      adminCustomerRoutes);

app.use(`${API}/branches`, debtRoutes);        // GET|POST /branches/:branchId/debts
app.use(`${API}/debts`,    debtActionRoutes);  // POST /debts/:id/payment, PATCH /debts/:id
app.use(`${API}/admin`,    adminDebtRoutes);   // GET /admin/debts

app.use(`${API}/branches`, creditRoutes);        // GET|POST /branches/:branchId/credits
app.use(`${API}/credits`,  creditActionRoutes);  // POST /credits/:id/payment, PATCH /credits/:id
app.use(`${API}/admin`,    adminCreditRoutes);   // GET /admin/credits

app.use(notFound);
app.use(errorHandler);

module.exports = app;