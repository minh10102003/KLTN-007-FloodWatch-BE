-- 1. Xóa các bảng cũ nếu chúng đã tồn tại (Xóa theo thứ tự này để tránh lỗi ràng buộc)
DROP TABLE IF EXISTS flood_logs;
DROP TABLE IF EXISTS crowd_reports;
DROP TABLE IF EXISTS sensor_thresholds;
DROP TABLE IF EXISTS sensors;

-- 2. Kích hoạt PostGIS (nếu chưa có)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 3. Tạo bảng SENSORS (Danh mục trạm - Đây là bảng gốc)
-- Nghiệp vụ: Định danh trạm đo, Số hóa vị trí, Cấu hình thông số vật lý
CREATE TABLE sensors (
    sensor_id VARCHAR(50) PRIMARY KEY,
    location_name VARCHAR(100) NOT NULL,
    coords GEOGRAPHY(Point, 4326) NOT NULL,
    hardware_type VARCHAR(20), -- 'ESP32', 'LoRa', 'Wokwi'
    model VARCHAR(50), -- Model của cảm biến
    installation_date DATE, -- Ngày lắp đặt
    installation_height FLOAT NOT NULL DEFAULT 0, -- Độ cao lắp đặt (cm) - khoảng cách từ cảm biến tới đáy cống
    is_active BOOLEAN DEFAULT TRUE,
    last_data_time TIMESTAMP, -- Thời gian nhận dữ liệu cuối cùng (để health check)
    status VARCHAR(20) DEFAULT 'normal', -- 'normal', 'warning', 'danger', 'offline'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tạo bảng SENSOR_THRESHOLDS (Ngưỡng báo động động cho từng sensor)
-- Nghiệp vụ: Thiết lập ngưỡng báo động động
CREATE TABLE sensor_thresholds (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(50) REFERENCES sensors(sensor_id) ON DELETE CASCADE,
    warning_threshold FLOAT NOT NULL DEFAULT 10, -- Mức Vàng (Cảnh báo) - cm
    danger_threshold FLOAT NOT NULL DEFAULT 30, -- Mức Đỏ (Nguy hiểm) - cm
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(100), -- Admin cập nhật
    UNIQUE(sensor_id)
);

-- 5. Tạo bảng FLOOD_LOGS (Dữ liệu lịch sử - Liên kết với sensors)
-- Nghiệp vụ: Giám sát & Phân tích Real-time
CREATE TABLE flood_logs (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(50) REFERENCES sensors(sensor_id) ON DELETE CASCADE,
    raw_distance FLOAT, -- Khoảng cách đo được từ cảm biến (cm)
    water_level FLOAT NOT NULL, -- Mực nước = installation_height - raw_distance (cm)
    velocity FLOAT, -- Vận tốc nước dâng (cm/phút) - so sánh với 5 phút trước
    status VARCHAR(20) DEFAULT 'normal', -- 'normal', 'warning', 'danger', 'offline'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Tạo bảng CROWD_REPORTS (Dữ liệu từ người dân báo cáo)
-- Nghiệp vụ: Tương tác Cộng đồng (Crowdsourcing)
CREATE TABLE crowd_reports (
    id SERIAL PRIMARY KEY,
    reporter_name VARCHAR(100),
    reporter_id VARCHAR(100), -- ID người báo cáo (để tính điểm tin cậy)
    flood_level VARCHAR(50), -- 'Nhẹ' (đến mắt cá), 'Trung bình' (đến đầu gối), 'Nặng' (ngập nửa xe)
    location GEOGRAPHY(Point, 4326) NOT NULL,
    reliability_score FLOAT DEFAULT 50, -- Điểm tin cậy (0-100), bắt đầu từ 50
    validation_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'verified', 'rejected', 'cross_verified'
    verified_by_sensor BOOLEAN DEFAULT FALSE, -- Có được xác minh bởi sensor không
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Tạo index để tối ưu truy vấn
CREATE INDEX idx_flood_logs_sensor_created ON flood_logs(sensor_id, created_at DESC);
CREATE INDEX idx_flood_logs_created ON flood_logs(created_at DESC);
CREATE INDEX idx_crowd_reports_location ON crowd_reports USING GIST(location);
CREATE INDEX idx_crowd_reports_created ON crowd_reports(created_at DESC);
CREATE INDEX idx_sensors_coords ON sensors USING GIST(coords);

-- 8. Chèn dữ liệu mẫu cho trạm S01 (Để test Wokwi)
-- ⚠️ QUAN TRỌNG: installation_height phải khớp với INSTALL_HEIGHT trong code ESP32 (150cm)
INSERT INTO sensors (sensor_id, location_name, coords, hardware_type, model, installation_date, installation_height)
VALUES ('S01', 'Cầu Sài Gòn - Bình Thạnh', ST_SetSRID(ST_MakePoint(106.721, 10.798), 4326)::geography, 'Wokwi_ESP32', 'HC-SR04', '2024-01-01', 150.0);

-- 9. Chèn ngưỡng mặc định cho S01
INSERT INTO sensor_thresholds (sensor_id, warning_threshold, danger_threshold, updated_by)
VALUES ('S01', 10, 30, 'system');


