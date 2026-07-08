const { verifyAccessToken } = require('../utils/jwt');
const { error } = require('../utils/apiResponse');

/**
 * authenticate — verifies the Bearer JWT and attaches req.user.
 * req.user = { userId, role, branchId }
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, 'Missing or malformed Authorization header', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    return error(res, 'Token invalid or expired', 401);
  }
};

/**
 * authorize(...roles) — gates a route to specific roles.
 * Usage: router.get('/path', authenticate, authorize('super_admin'), handler)
 */
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return error(res, 'You do not have permission to perform this action', 403);
  }
  next();
};

/**
 * scopeBranch — enforces branch isolation (§7.2).
 * For branch_manager and cashier: req.params.id must match their branchId.
 * super_admin can access any branch.
 */
const scopeBranch = (req, res, next) => {
  const { role, branchId } = req.user;
  if (role === 'super_admin') return next();


const requestedBranch = req.params.branchId || req.params.id;
  if (!requestedBranch) {
    return error(res, 'Branch ID is required', 400);
  }
  if (branchId !== requestedBranch) {
    return error(res, 'Access denied: you can only access your own branch', 403);
  }
  next();
};

module.exports = { authenticate, authorize, scopeBranch };