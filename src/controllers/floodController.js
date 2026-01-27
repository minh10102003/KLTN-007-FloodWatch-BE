const floodModel = require('../models/floodModel');

const floodController = {
    // Lấy tất cả dữ liệu ngập lụt để hiển thị lên bản đồ (API cũ - giữ để tương thích)
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

    // Lấy dữ liệu ngập lụt kèm thông tin sensor (join với bảng sensors) - API mới
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
    },

    // Lấy dữ liệu real-time với đầy đủ trạng thái (KHUYẾN NGHỊ cho Frontend)
    getRealTimeFloodData: async (req, res) => {
        try {
            const data = await floodModel.getRealTimeFloodData();
            
            // Format dữ liệu cho Frontend với trạng thái rõ ràng
            const formattedData = data.map(item => {
                // Xác định trạng thái cuối cùng (ưu tiên sensor_status nếu offline)
                let finalStatus = item.sensor_status === 'offline' ? 'offline' : (item.log_status || item.sensor_status || 'normal');
                
                return {
                    sensor_id: item.sensor_id,
                    location_name: item.location_name,
                    model: item.model,
                    water_level: item.water_level || 0,
                    velocity: item.velocity,
                    status: finalStatus,
                    lng: parseFloat(item.lng),
                    lat: parseFloat(item.lat),
                    warning_threshold: item.warning_threshold || 10,
                    danger_threshold: item.danger_threshold || 30,
                    last_data_time: item.last_data_time,
                    created_at: item.created_at
                };
            });
            
            res.json({
                success: true,
                data: formattedData
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Lấy lịch sử dữ liệu cho một sensor cụ thể
    getFloodHistoryBySensor: async (req, res) => {
        try {
            const { sensorId } = req.params;
            const { limit } = req.query;
            const data = await floodModel.getFloodHistoryBySensor(sensorId, limit || 100);
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

