const Category = require('../models/Category');
const { success, error } = require('../utils/apiResponse');

// GET /api/v1/categories?type=income&branchId=xxx
const listCategories = async (req, res) => {
  try {
    const { type, branchId } = req.query;

    if (!type || !['income', 'expense'].includes(type)) {
      return error(res, 'type query param must be income or expense', 400);
    }

    // Return global categories + branch-specific ones (if branchId provided)
    const filter = {
      isActive: true,
      type,
      $or: [
        { branchId: null },                          // global/shared
        ...(branchId ? [{ branchId }] : []),         // branch-specific
      ],
    };

    const categories = await Category.find(filter).sort({ name: 1 });
    return success(res, { categories });
  } catch (err) {
    console.error('[categories/list]', err);
    return error(res, 'Server error', 500);
  }
};

// POST /api/v1/categories  (super_admin only)
const createCategory = async (req, res) => {
  try {
    const { name, type, branchId } = req.body;
    const category = await Category.create({
      name,
      type,
      branchId: branchId ?? null,
    });
    return success(res, { category }, 201);
  } catch (err) {
    console.error('[categories/create]', err);
    return error(res, 'Server error', 500);
  }
};

module.exports = { listCategories, createCategory };