const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { writeAuditLog } = require('../utils/auditLogger');
const { success, error } = require('../utils/apiResponse');

// GET /api/v1/users
// super_admin: all users; branch_manager: only users in their branch
const listUsers = async (req, res) => {
  try {
      const allUsers = await User.find();
    console.log('All users:', allUsers);
    const { role, branchId } = req.user;

    const filter = role === 'super_admin' ? {} : { branchId };

    const users = await User.find(filter).sort({ createdAt: -1 });
    return success(res, { users });
  } catch (err) {
    console.error('[users/list]', err);
    return error(res, 'Server error', 500);
  }
};

// POST /api/v1/users
const createUser = async (req, res) => {
  try {
    const { name, email, password, role, branchId } = req.body;

    // Branch managers can only create cashiers within their own branch
    if (req.user.role === 'branch_manager') {
      if (role !== 'cashier') {
        return error(res, 'Branch managers can only create cashier accounts', 403);
      }
      if (branchId && branchId !== req.user.branchId) {
        return error(res, 'Branch managers can only create users for their own branch', 403);
      }
    }

    const existing = await User.findOne({ email });
    if (existing) return error(res, 'A user with that email already exists', 409);

    const user = await User.create({
      name,
      email,
      passwordHash: password, // pre-save hook hashes it
      role,
      branchId: branchId || null,
    });

    writeAuditLog({
      action: 'create',
      collection: 'users',
      documentId: user._id,
      actor: req.user.userId,
      branchId: user.branchId,
      after: user.toObject(),
      ip: req.ip,
    });

    return success(res, { user }, 201);
  } catch (err) {
    console.error('[users/create]', err);
    return error(res, 'Server error', 500);
  }
};

// GET /api/v1/users/:id
const getUser = async (req, res) => {
  try {
  
    const user = await User.findById(req.params.id);
    if (!user) return error(res, 'User not found', 404);

    // Users can view themselves; branch_managers can view users in their branch only
    const { role, branchId, userId } = req.user;
    if (
      role !== 'super_admin' &&
      userId !== user._id.toString() &&
      (role !== 'branch_manager' || branchId !== user.branchId?.toString())
    ) {
      return error(res, 'Access denied', 403);
    }

    return success(res, { user });
  } catch (err) {
    console.error('[users/get]', err);
    return error(res, 'Server error', 500);
  }
};

// PATCH /api/v1/users/:id
const updateUser = async (req, res) => {
  try {
    const { name, email, role, branchId, isActive } = req.body;
    const { role: actorRole, branchId: actorBranchId, userId: actorId } = req.user;

    const user = await User.findById(req.params.id);
    if (!user) return error(res, 'User not found', 404);

    // Only super_admin can change roles or reassign branches
    if ((role !== undefined || branchId !== undefined) && actorRole !== 'super_admin') {
      return error(res, 'Only super admins can change roles or branch assignments', 403);
    }

    // Branch managers can only edit users in their own branch
    if (
      actorRole === 'branch_manager' &&
      actorId !== user._id.toString() &&
      actorBranchId !== user.branchId?.toString()
    ) {
      return error(res, 'Access denied: you can only manage users in your own branch', 403);
    }

    // Non-super-admins cannot edit their own role or active status
    if (actorRole !== 'super_admin' && actorId === user._id.toString()) {
      if (role !== undefined || isActive !== undefined) {
        return error(res, 'You cannot change your own role or account status', 403);
      }
    }

    const before = user.toObject();

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (role !== undefined) user.role = role;
    if (branchId !== undefined) user.branchId = branchId;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    // If account was deactivated, revoke all refresh tokens
    if (isActive === false) {
      await RefreshToken.deleteMany({ userId: user._id });
    }

    writeAuditLog({
      action: 'edit',
      collection: 'users',
      documentId: user._id,
      actor: actorId,
      branchId: user.branchId,
      before,
      after: user.toObject(),
      ip: req.ip,
    });

    return success(res, { user });
  } catch (err) {
    console.error('[users/update]', err);
    return error(res, 'Server error', 500);
  }
};

// DELETE /api/v1/users/:id  (soft deactivate)
const deactivateUser = async (req, res) => {
  try {
    const { userId: actorId, role: actorRole, branchId: actorBranchId } = req.user;

    const user = await User.findById(req.params.id);
    if (!user) return error(res, 'User not found', 404);

    if (actorId === user._id.toString()) {
      return error(res, 'You cannot deactivate your own account', 400);
    }

    // Branch managers can only deactivate cashiers in their branch
    if (actorRole === 'branch_manager') {
      if (user.role !== 'cashier' || actorBranchId !== user.branchId?.toString()) {
        return error(res, 'Access denied: you can only deactivate cashiers in your branch', 403);
      }
    }

    if (!user.isActive) return error(res, 'User is already deactivated', 400);

    const before = user.toObject();

    user.isActive = false;
    await user.save();

    // Revoke all active sessions
    await RefreshToken.deleteMany({ userId: user._id });

    writeAuditLog({
      action: 'deactivate',
      collection: 'users',
      documentId: user._id,
      actor: actorId,
      branchId: user.branchId,
      before,
      after: user.toObject(),
      ip: req.ip,
    });

    return success(res, { user });
  } catch (err) {
    console.error('[users/deactivate]', err);
    return error(res, 'Server error', 500);
  }
};

module.exports = { listUsers, createUser, getUser, updateUser, deactivateUser };