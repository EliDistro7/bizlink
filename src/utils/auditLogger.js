const AuditLog = require('../models/AuditLog');

/**
 * Write an audit log entry (fire-and-forget — never throws).
 *
 * @param {object} params
 * @param {string}  params.action      - 'create' | 'edit' | 'void' | 'delete' | 'approve' | 'reject' | 'login' | 'logout'
 * @param {string}  params.collection  - collection name e.g. 'users', 'incomes', 'expenses'
 * @param {*}       params.documentId  - ObjectId of the affected document
 * @param {*}       params.actor       - ObjectId of the user performing the action
 * @param {*}       [params.branchId]  - ObjectId of the branch (optional)
 * @param {string}  [params.reason]    - reason for the action (optional)
 * @param {object}  [params.before]    - document snapshot before change (optional)
 * @param {object}  [params.after]     - document snapshot after change (optional)
 * @param {string}  [params.ip]        - request IP address (optional)
 */
const writeAuditLog = (params) => {
  AuditLog.create(params).catch((err) => {
    console.error('[auditLogger] Failed to write audit log:', err.message);
  });
};

module.exports = { writeAuditLog };