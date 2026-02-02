const floodRepository = require('../repositories/floodRepository');

const heatmapController = {
    // Lấy dữ liệu heatmap
    getHeatmapData: async (req, res) => {
        try {
            const { minLng, minLat, maxLng, maxLat, gridSize } = req.query;

            const bounds = (minLng && minLat && maxLng && maxLat) ? {
                minLng: parseFloat(minLng),
                minLat: parseFloat(minLat),
                maxLng: parseFloat(maxLng),
                maxLat: parseFloat(maxLat)
            } : null;

            const data = await floodRepository.getHeatmapData(bounds, parseInt(gridSize) || 500);
            res.json({
                success: true,
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Lấy dữ liệu heatmap kết hợp (sensor + crowd reports)
    getCombinedHeatmapData: async (req, res) => {
        try {
            const { minLng, minLat, maxLng, maxLat } = req.query;

            const bounds = (minLng && minLat && maxLng && maxLat) ? {
                minLng: parseFloat(minLng),
                minLat: parseFloat(minLat),
                maxLng: parseFloat(maxLng),
                maxLat: parseFloat(maxLat)
            } : null;

            const data = await floodRepository.getCombinedHeatmapData(bounds);
            res.json({
                success: true,
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
};

module.exports = heatmapController;

