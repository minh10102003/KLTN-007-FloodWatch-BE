const floodModel = require('../models/floodModel');

const floodController = {
    // Lấy tất cả dữ liệu ngập lụt để hiển thị lên bản đồ
    getFloodHistory: async (req, res) => {
        try {
            const data = await floodModel.getAllFloodLogs();
            res.json({
                success: true,
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Lấy dữ liệu ngập lụt kèm thông tin sensor (join với bảng sensors)
    getFloodData: async (req, res) => {
        try {
            const data = await floodModel.getFloodDataWithSensors();
            res.json({
                success: true,
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
};

module.exports = floodController;

