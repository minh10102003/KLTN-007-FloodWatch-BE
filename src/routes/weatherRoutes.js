const express = require('express');
const router = express.Router();
const weatherController = require('../controllers/weatherController');

/**
 * @swagger
 * /api/v1/weather/hcm:
 *   get:
 *     summary: Thời tiết TP.HCM qua Open-Meteo (miễn phí, không API key)
 *     tags: [Weather]
 *     description: |
 *       Proxy [Open-Meteo](https://open-meteo.com/) với **mặc định trung tâm TP.HCM**: 10°49′23″N, 106°37′46″E (≈ 10.823056, 106.629444).
 *       Có cache ngắn (mặc định 600s) để giảm số lần gọi ra ngoài. Tuỳ chỉnh `WEATHER_HCM_LAT`, `WEATHER_HCM_LON`, `WEATHER_CACHE_SECONDS` trong `.env`.
 *     parameters:
 *       - in: query
 *         name: forecast_days
 *         schema: { type: integer, default: 3, minimum: 1, maximum: 7 }
 *       - in: query
 *         name: lat
 *         schema: { type: number }
 *         description: Tuỳ chọn; phải kèm `lon`, và nằm trong bbox TP.HCM
 *       - in: query
 *         name: lon
 *         schema: { type: number }
 *     responses:
 *       200:
 *         description: Thành công (current + hourly từ Open-Meteo)
 *       400:
 *         description: lat/lon không hợp lệ hoặc ngoài TP.HCM
 *       502:
 *         description: Open-Meteo không phản hồi
 */
router.get('/v1/weather/hcm', weatherController.getHcmWeather);

module.exports = router;
