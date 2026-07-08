const Branch = require('../models/Branch');
const { writeAuditLog } = require('../utils/auditLogger');
const { success, error } = require('../utils/apiResponse');

// GET /api/v1/branches
const listBranches = async (req, res) => {
  try {
    const branches = await Branch.find().sort({ createdAt: -1 });
    return success(res, { branches });
  } catch (err) {
    console.error('[branches/list]', err);
    return error(res, 'Server error', 500);
  }
};

// POST /api/v1/branches
const createBranch = async (req, res) => {
  try {
    const { name, location, contactPhone } = req.body;

    const branch = await Branch.create({ name, location, contactPhone });

    writeAuditLog({
      action: 'create',
      collection: 'branches',
      documentId: branch._id,
      actor: req.user.userId,
      after: branch.toObject(),
      ip: req.ip,
    });

    return success(res, { branch }, 201);
  } catch (err) {
    console.error('[branches/create]', err);
    return error(res, 'Server error', 500);
  }
};

// GET /api/v1/branches/:id
const getBranch = async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) return error(res, 'Branch not found', 404);

    // Branch managers and cashiers can only view their own branch
    const { role, branchId } = req.user;
    if (role !== 'super_admin' && branchId !== branch._id.toString()) {
      return error(res, 'Access denied: you can only access your own branch', 403);
    }

    return success(res, { branch });
  } catch (err) {
    console.error('[branches/get]', err);
    return error(res, 'Server error', 500);
  }
};

// PATCH /api/v1/branches/:id
const updateBranch = async (req, res) => {
  try {
    const { name, location, contactPhone, isActive } = req.body;

    const branch = await Branch.findById(req.params.id);
    if (!branch) return error(res, 'Branch not found', 404);

    const before = branch.toObject();

    if (name !== undefined) branch.name = name;
    if (location !== undefined) branch.location = location;
    if (contactPhone !== undefined) branch.contactPhone = contactPhone;
    if (isActive !== undefined) branch.isActive = isActive;

    await branch.save();

    writeAuditLog({
      action: 'edit',
      collection: 'branches',
      documentId: branch._id,
      actor: req.user.userId,
      before,
      after: branch.toObject(),
      ip: req.ip,
    });

    return success(res, { branch });
  } catch (err) {
    console.error('[branches/update]', err);
    return error(res, 'Server error', 500);
  }
};

module.exports = { listBranches, createBranch, getBranch, updateBranch };