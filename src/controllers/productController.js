const Product = require('../models/Product');
const { writeAuditLog } = require('../utils/auditLogger');
const { success, error } = require('../utils/apiResponse');

// GET /api/v1/branches/:branchId/products
const listProducts = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { search, lowStock, isActive = 'true', page = 1, limit = 50 } = req.query;

    const filter = { branchId };
    if (isActive !== 'all') filter.isActive = isActive === 'true';
    if (search) filter.name = { $regex: search, $options: 'i' };
    if (lowStock === 'true') {
      // products where stockQuantity <= lowStockThreshold
      filter.$expr = { $lte: ['$stockQuantity', '$lowStockThreshold'] };
    }

    const pageNum  = parseInt(page,  10);
    const limitNum = parseInt(limit, 10);

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort({ name: 1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Product.countDocuments(filter),
    ]);

    return success(res, {
      products,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    console.error('[products/list]', err);
    return error(res, 'Server error', 500);
  }
};

// POST /api/v1/branches/:branchId/products
const createProduct = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { name, sku, unit, sellingPrice, costPrice, stockQuantity, lowStockThreshold } = req.body;

    const product = await Product.create({
      branchId,
      name,
      sku:              sku   || undefined,
      unit:             unit  || 'unit',
      sellingPrice,
      costPrice:        costPrice        ?? 0,
      stockQuantity:    stockQuantity    ?? 0,
      lowStockThreshold: lowStockThreshold ?? 10,
    });

    writeAuditLog({
      action: 'create', collection: 'products',
      documentId: product._id, actor: req.user.userId,
      branchId, after: product.toObject(), ip: req.ip,
    });

    return success(res, { product }, 201);
  } catch (err) {
    if (err.code === 11000) return error(res, 'A product with that SKU already exists in this branch', 409);
    console.error('[products/create]', err);
    return error(res, 'Server error', 500);
  }
};

// GET /api/v1/branches/:branchId/products/:productId
const getProduct = async (req, res) => {
  try {
    const { branchId, productId } = req.params;
    const product = await Product.findOne({ _id: productId, branchId });
    if (!product) return error(res, 'Product not found', 404);
    return success(res, { product });
  } catch (err) {
    console.error('[products/get]', err);
    return error(res, 'Server error', 500);
  }
};

// PATCH /api/v1/branches/:branchId/products/:productId
const updateProduct = async (req, res) => {
  try {
    const { branchId, productId } = req.params;
    const { name, sku, unit, sellingPrice, costPrice, lowStockThreshold, isActive } = req.body;

    const product = await Product.findOne({ _id: productId, branchId });
    if (!product) return error(res, 'Product not found', 404);

    const before = product.toObject();

    if (name              !== undefined) product.name              = name;
    if (sku               !== undefined) product.sku               = sku;
    if (unit              !== undefined) product.unit              = unit;
    if (sellingPrice      !== undefined) product.sellingPrice      = sellingPrice;
    if (costPrice         !== undefined) product.costPrice         = costPrice;
    if (lowStockThreshold !== undefined) product.lowStockThreshold = lowStockThreshold;
    if (isActive          !== undefined) product.isActive          = isActive;

    await product.save();

    writeAuditLog({
      action: 'edit', collection: 'products',
      documentId: product._id, actor: req.user.userId,
      branchId, before, after: product.toObject(), ip: req.ip,
    });

    return success(res, { product });
  } catch (err) {
    if (err.code === 11000) return error(res, 'A product with that SKU already exists in this branch', 409);
    console.error('[products/update]', err);
    return error(res, 'Server error', 500);
  }
};

module.exports = { listProducts, createProduct, getProduct, updateProduct };