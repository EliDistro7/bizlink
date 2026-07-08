const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: {
      type: String,
      enum: ['create', 'edit', 'void', 'delete', 'approve', 'reject', 'login', 'logout'],
      required: true,
    },
    collection: { type: String, required: true },   // 'incomes' | 'expenses' | 'users' | etc.
    documentId: { type: mongoose.Schema.Types.ObjectId, required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    reason: { type: String, default: null },
    before: { type: mongoose.Schema.Types.Mixed, default: null }, // snapshot before edit
    after: { type: mongoose.Schema.Types.Mixed, default: null },  // snapshot after edit
    ip: { type: String, default: null },
  },
  {
    timestamps: true,
    // Audit logs are immutable — disable updates at schema level
    strict: true,
  }
);

auditLogSchema.index({ documentId: 1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);