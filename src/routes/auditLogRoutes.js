const express = require('express');
const router = express.Router();
const auditLogController = require('../controllers/auditLogController');
const { authenticate, requireAdmin } = require('../middleware/auth');

/**
 * GET /api/audit-logs
 * Lấy nhật ký hệ thống (chỉ Admin)
 * Query: limit, offset, from (ISO), to (ISO), action, entity_type
 */
router.get('/audit-logs', authenticate, requireAdmin, auditLogController.getAuditLogs);

module.exports = router;
