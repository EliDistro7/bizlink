const Customer = require('../models/Customer');
const { writeAuditLog } = require('../utils/auditLogger');
const { success, error } = require('../utils/apiResponse');

// GET /api/v1/branches/:branchId/customers
const listCustomers = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { search, isActive = 'true', page = 1, limit = 20 } = req.query;

    const filter = { branchId };
    if (isActive !== 'all') filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { name:  { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum  = parseInt(page,  10);
    const limitNum = parseInt(limit, 10);

    const [customers, total] = await Promise.all([
      Customer.find(filter)
        .sort({ name: 1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Customer.countDocuments(filter),
    ]);

    return success(res, {
      customers,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    console.error('[customers/list]', err);
    return error(res, 'Server error', 500);
  }
};

// POST /api/v1/branches/:branchId/customers
const createCustomer = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { name, phone, email, address, notes } = req.body;

    const customer = await Customer.create({
      branchId,
      name,
      phone,
      email:   email   || null,
      address: address || null,
      notes:   notes   || null,
    });

    writeAuditLog({
      action: 'create', collection: 'customers',
      documentId: customer._id, actor: req.user.userId,
      branchId, after: customer.toObject(), ip: req.ip,
    });

    return success(res, { customer }, 201);
  } catch (err) {
    if (err.code === 11000) return error(res, 'A customer with that phone number already exists in this branch', 409);
    console.error('[customers/create]', err);
    return error(res, 'Server error', 500);
  }
};

// PATCH /api/v1/customers/:id
const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, address, notes, isActive } = req.body;

    const customer = await Customer.findById(id);
    if (!customer) return error(res, 'Customer not found', 404);

    // Branch-scoped roles can only edit customers in their own branch
    if (req.user.role !== 'super_admin' && String(customer.branchId) !== req.user.branchId) {
      return error(res, 'Access denied: you can only modify customers in your own branch', 403);
    }

    const before = customer.toObject();

    if (name     !== undefined) customer.name     = name;
    if (phone    !== undefined) customer.phone    = phone;
    if (email    !== undefined) customer.email    = email;
    if (address  !== undefined) customer.address  = address;
    if (notes    !== undefined) customer.notes    = notes;
    if (isActive !== undefined) customer.isActive = isActive;

    await customer.save();

    writeAuditLog({
      action: 'edit', collection: 'customers',
      documentId: customer._id, actor: req.user.userId,
      branchId: customer.branchId, before, after: customer.toObject(), ip: req.ip,
    });

    return success(res, { customer });
  } catch (err) {
    if (err.code === 11000) return error(res, 'A customer with that phone number already exists in this branch', 409);
    console.error('[customers/update]', err);
    return error(res, 'Server error', 500);
  }
};

// DELETE /api/v1/customers/:id  (soft deactivate)
const deactivateCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findById(id);
    if (!customer) return error(res, 'Customer not found', 404);

    // Branch-scoped roles can only deactivate customers in their own branch
    if (req.user.role !== 'super_admin' && String(customer.branchId) !== req.user.branchId) {
      return error(res, 'Access denied: you can only modify customers in your own branch', 403);
    }

    const before = customer.toObject();
    customer.isActive = false;
    await customer.save();

    writeAuditLog({
      action: 'deactivate', collection: 'customers',
      documentId: customer._id, actor: req.user.userId,
      branchId: customer.branchId, before, after: customer.toObject(), ip: req.ip,
    });

    return success(res, { customer });
  } catch (err) {
    console.error('[customers/deactivate]', err);
    return error(res, 'Server error', 500);
  }
};

module.exports = { listCustomers, createCustomer, updateCustomer, deactivateCustomer };
