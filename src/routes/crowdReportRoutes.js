const express = require('express');
const router = express.Router();
const crowdReportController = require('../controllers/crowdReportController');

// GET /api/crowd-reports
router.get('/crowd-reports', crowdReportController.getCrowdReports);

// POST /api/report-flood
router.post('/report-flood', crowdReportController.createReport);

module.exports = router;


