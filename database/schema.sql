-- 1. Xóa các bảng cũ nếu chúng đã tồn tại (Xóa theo thứ tự này để tránh lỗi ràng buộc)
DROP TABLE IF EXISTS flood_logs;
DROP TABLE IF EXISTS crowd_reports;
DROP TABLE IF EXISTS sensors;

-- 2. Kích hoạt PostGIS (nếu chưa có)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 3. Tạo bảng SENSORS (Danh mục trạm - Đây là bảng gốc)
CREATE TABLE sensors (
    sensor_id VARCHAR(50) PRIMARY KEY,
    location_name VARCHAR(100) NOT NULL,
    coords GEOGRAPHY(Point, 4326) NOT NULL,
    hardware_type VARCHAR(20), -- 'ESP32', 'LoRa', 'Wokwi'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tạo bảng FLOOD_LOGS (Dữ liệu lịch sử - Liên kết với sensors)
CREATE TABLE flood_logs (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(50) REFERENCES sensors(sensor_id) ON DELETE CASCADE,
    water_level FLOAT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tạo bảng CROWD_REPORTS (Dữ liệu từ người dân báo cáo)
CREATE TABLE crowd_reports (
    id SERIAL PRIMARY KEY,
    reporter_name VARCHAR(100),
    flood_level VARCHAR(50), -- Nhẹ, Trung bình, Nặng
    location GEOGRAPHY(Point, 4326) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Chèn dữ liệu mẫu cho trạm S01 (Để test Wokwi)
INSERT INTO sensors (sensor_id, location_name, coords, hardware_type)
VALUES ('S01', 'Cầu Sài Gòn - Bình Thạnh', ST_SetSRID(ST_MakePoint(106.721, 10.798), 4326)::geography, 'Wokwi_ESP32');


