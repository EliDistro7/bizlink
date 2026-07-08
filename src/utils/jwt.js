const jwt = require('jsonwebtoken');

/**
 * JWT payload shape (§6.1):
 *   { userId, role, branchId }
 */

const signAccessToken = (user) => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
      branchId: user.branchId ? user.branchId.toString() : null,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );
};

const signRefreshToken = (userId) => {
  return jwt.sign(
    { userId: userId.toString() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

/**
 * Parse the expiry string ('7d', '15m') into a JS Date — used to set
 * RefreshToken.expiresAt so the MongoDB TTL index can clean up.
 */
const parseExpiryToDate = (expiresIn) => {
  const unit = expiresIn.slice(-1);
  const value = parseInt(expiresIn.slice(0, -1), 10);
  const ms = unit === 'd' ? value * 86400000
           : unit === 'h' ? value * 3600000
           : unit === 'm' ? value * 60000
           : value * 1000;
  return new Date(Date.now() + ms);
};

module.exports = { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, parseExpiryToDate };