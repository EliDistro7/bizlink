const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { signAccessToken, signRefreshToken, verifyRefreshToken, parseExpiryToDate } = require('../utils/jwt');
const { writeAuditLog } = require('../utils/auditLogger');
const { success, error } = require('../utils/apiResponse');

// POST /api/v1/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email, isActive: true });
    if (!user) return error(res, 'Invalid credentials', 401);

    const valid = await user.comparePassword(password);
    if (!valid) return error(res, 'Invalid credentials', 401);

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user._id);

    // Persist refresh token so we can invalidate it on logout
    await RefreshToken.create({
      userId: user._id,
      token: refreshToken,
      expiresAt: parseExpiryToDate(process.env.JWT_REFRESH_EXPIRES_IN || '7d'),
    });

    writeAuditLog({
      action: 'login',
      collection: 'users',
      documentId: user._id,
      actor: user._id,
      branchId: user.branchId,
      ip: req.ip,
    });

    return success(res, { accessToken, refreshToken, user });
  } catch (err) {
    console.error('[auth/login]', err);
    return error(res, 'Server error', 500);
  }
};

// POST /api/v1/auth/refresh
const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return error(res, 'Refresh token required', 400);

    // Verify signature
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      return error(res, 'Invalid or expired refresh token', 401);
    }

    // Check it exists in DB (not already logged out)
    const stored = await RefreshToken.findOne({ token: refreshToken });
    if (!stored) return error(res, 'Refresh token revoked', 401);

    const user = await User.findById(payload.userId);
    if (!user || !user.isActive) return error(res, 'User not found or deactivated', 401);

    // Rotate: delete old, issue new pair
    await RefreshToken.deleteOne({ _id: stored._id });

    const newAccessToken = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user._id);

    await RefreshToken.create({
      userId: user._id,
      token: newRefreshToken,
      expiresAt: parseExpiryToDate(process.env.JWT_REFRESH_EXPIRES_IN || '7d'),
    });

    return success(res, { accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    console.error('[auth/refresh]', err);
    return error(res, 'Server error', 500);
  }
};

// POST /api/v1/auth/logout
const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await RefreshToken.deleteOne({ token: refreshToken });
    }

    writeAuditLog({
      action: 'logout',
      collection: 'users',
      documentId: req.user.userId,
      actor: req.user.userId,
      ip: req.ip,
    });

    return success(res, null, 200);
  } catch (err) {
    console.error('[auth/logout]', err);
    return error(res, 'Server error', 500);
  }
};

// POST /api/v1/auth/change-password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user) return error(res, 'User not found', 404);

    const valid = await user.comparePassword(currentPassword);
    if (!valid) return error(res, 'Current password is incorrect', 401);

    user.passwordHash = newPassword; // pre-save hook re-hashes
    await user.save();

    // Invalidate all refresh tokens on password change
    await RefreshToken.deleteMany({ userId: user._id });

    return success(res, { message: 'Password changed successfully' });
  } catch (err) {
    console.error('[auth/change-password]', err);
    return error(res, 'Server error', 500);
  }
};

module.exports = { login, refresh, logout, changePassword };