const express = require('express');
const router = express.Router();
const floodController = require('../controllers/floodController');

// GET /api/flood-history (API cũ - giữ lại để tương thích)
router.get('/flood-history', floodController.getFloodHistory);

// GET /api/v1/flood-data/realtime (API mới - dữ liệu real-time với đầy đủ trạng thái) ⭐ KHUYẾN NGHỊ
// QUAN TRỌNG: Route cụ thể phải đặt TRƯỚC route tổng quát
router.get('/v1/flood-data/realtime', floodController.getRealTimeFloodData);

// GET /api/v1/flood-data (API mới - join với bảng sensors)
router.get('/v1/flood-data', floodController.getFloodData);

// GET /api/sensors/:sensorId/history - Lấy lịch sử dữ liệu cho một sensor
router.get('/sensors/:sensorId/history', floodController.getFloodHistoryBySensor);

module.exports = router;

