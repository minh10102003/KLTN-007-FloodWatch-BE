const openMeteoService = require('../services/openMeteoService');

const weatherController = {
    /**
     * Thời tiết Open-Meteo cho TP.HCM (mặc định trung tâm theo Cổng TT TP.HCM).
     * Query lat/lon tuỳ chọn — nếu có thì phải nằm trong bbox TP.HCM.
     */
    getHcmWeather: async (req, res) => {
        try {
            const defaults = openMeteoService.readDefaultCoords();
            let latitude = defaults.latitude;
            let longitude = defaults.longitude;
            let usedOverride = false;

            if (req.query.lat != null && req.query.lon != null) {
                const lat = parseFloat(req.query.lat);
                const lon = parseFloat(req.query.lon);
                if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                    return res.status(400).json({
                        success: false,
                        error: 'lat và lon phải là số (ví dụ ?lat=10.823056&lon=106.629444)'
                    });
                }
                if (!openMeteoService.isInsideHcmBounds(lat, lon)) {
                    return res.status(400).json({
                        success: false,
                        error:
                            'lat/lon nằm ngoài phạm vi TP.HCM (khoảng 10.63–11.17°N, 106.37–106.93°E). Bỏ query để dùng trung tâm mặc định.'
                    });
                }
                latitude = lat;
                longitude = lon;
                usedOverride = true;
            }

            const forecastDays = Math.min(7, Math.max(1, parseInt(req.query.forecast_days, 10) || 3));
            const data = await openMeteoService.fetchForecast({
                latitude,
                longitude,
                forecastDays
            });

            res.json({
                success: true,
                data: {
                    label: usedOverride
                        ? 'TP.HCM (tọa độ tùy chỉnh trong phạm vi thành phố)'
                        : 'Trung tâm TP.HCM (10°49′23″N, 106°37′46″E — Cổng thông tin TP.HCM)',
                    reference: {
                        dms: '10°49′23″N, 106°37′46″E',
                        decimal: {
                            latitude: openMeteoService.DEFAULT_HCM_LAT,
                            longitude: openMeteoService.DEFAULT_HCM_LON
                        },
                        city_extent:
                            'Toàn thành phố khoảng 10°38′–11°10′N và 106°22′–106°56′E (tham chiếu địa lý)'
                    },
                    used_query_override: usedOverride,
                    ...data
                }
            });
        } catch (err) {
            res.status(502).json({
                success: false,
                error: err.message || 'Không lấy được dữ liệu Open-Meteo'
            });
        }
    }
};

module.exports = weatherController;
