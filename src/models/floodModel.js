const floodRepository = require('../repositories/floodRepository');

/**
 * Flood Model
 * Sử dụng FloodRepository để thực hiện các thao tác với database
 */
const floodModel = {
    // Lấy tất cả dữ liệu ngập lụt (API cũ - giữ để tương thích)
    getAllFloodLogs: async () => {
        return await floodRepository.getAllFloodLogs();
    },

    // Lấy dữ liệu ngập lụt kèm thông tin sensor (join với bảng sensors)
    // Trả về bản ghi mới nhất cho mỗi sensor
    getFloodDataWithSensors: async () => {
        return await floodRepository.getFloodDataWithSensors();
    },

    // Lấy dữ liệu real-time với đầy đủ trạng thái (KHUYẾN NGHỊ cho Frontend)
    getRealTimeFloodData: async () => {
        return await floodRepository.getRealTimeFloodData();
    },

    // Lấy lịch sử dữ liệu cho một sensor cụ thể
    getFloodHistoryBySensor: async (sensorId, limit = 100) => {
        return await floodRepository.getFloodHistoryBySensor(sensorId, limit);
    }
};

module.exports = floodModel;
