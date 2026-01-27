const express = require('express');
const router = express.Router();
const floodController = require('../controllers/floodController');

// GET /api/flood-history (API cũ - giữ lại để tương thích)
router.get('/flood-history', floodController.getFloodHistory);

// GET /api/v1/flood-data (API mới - join với bảng sensors)
router.get('/v1/flood-data', floodController.getFloodData);

module.exports = router;

