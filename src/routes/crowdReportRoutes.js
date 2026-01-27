const express = require('express');
const router = express.Router();
const crowdReportController = require('../controllers/crowdReportController');

// GET /api/crowd-reports - Lấy báo cáo trong 24h qua
router.get('/crowd-reports', crowdReportController.getCrowdReports);

// GET /api/crowd-reports/all - Lấy tất cả báo cáo
router.get('/crowd-reports/all', crowdReportController.getAllReports);

// POST /api/report-flood - Tạo báo cáo mới (với xác minh chéo)
router.post('/report-flood', crowdReportController.createReport);

module.exports = router;


