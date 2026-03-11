-- =============================================================================
-- HCM FLOOD BACKEND - FULL DATABASE SCHEMA
-- Script tạo database hoàn chỉnh từ đầu (PostgreSQL + PostGIS)
-- Chạy: psql -U user -d dbname -f full_schema.sql
--       hoặc: npm run migrate (nếu cấu hình chạy file này)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PHẦN 1: XÓA ĐỐI TƯỢNG CŨ (theo thứ tự phụ thuộc)
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trigger_flood_log_alert ON flood_logs;
DROP TRIGGER IF EXISTS trigger_update_reliability ON report_evaluations;

DROP TABLE IF EXISTS report_evaluations;
DROP TABLE IF EXISTS emergency_subscriptions;
DROP TABLE IF EXISTS ota_updates;
DROP TABLE IF EXISTS energy_logs;
DROP TABLE IF EXISTS alerts;
DROP TABLE IF EXISTS flood_logs;
DROP TABLE IF EXISTS crowd_reports;
DROP TABLE IF EXISTS sensor_thresholds;
DROP TABLE IF EXISTS sensors;
DROP TABLE IF EXISTS users;

-- -----------------------------------------------------------------------------
-- PHẦN 2: POSTGIS
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;

-- -----------------------------------------------------------------------------
-- PHẦN 3: BẢNG SENSORS (Danh mục trạm)
-- -----------------------------------------------------------------------------
CREATE TABLE sensors (
    sensor_id VARCHAR(50) PRIMARY KEY,
    location_name VARCHAR(100) NOT NULL,
    coords GEOGRAPHY(Point, 4326) NOT NULL,
    hardware_type VARCHAR(20),
    model VARCHAR(50),
    installation_date DATE,
    installation_height FLOAT NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    last_data_time TIMESTAMP,
    status VARCHAR(20) DEFAULT 'normal',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- PHẦN 4: BẢNG SENSOR_THRESHOLDS (Ngưỡng báo động)
-- -----------------------------------------------------------------------------
CREATE TABLE sensor_thresholds (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(50) REFERENCES sensors(sensor_id) ON DELETE CASCADE,
    warning_threshold FLOAT NOT NULL DEFAULT 10,
    danger_threshold FLOAT NOT NULL DEFAULT 30,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(100),
    UNIQUE(sensor_id)
);

-- -----------------------------------------------------------------------------
-- PHẦN 5: BẢNG FLOOD_LOGS (Dữ liệu mực nước)
-- -----------------------------------------------------------------------------
CREATE TABLE flood_logs (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(50) REFERENCES sensors(sensor_id) ON DELETE CASCADE,
    raw_distance FLOAT,
    water_level FLOAT NOT NULL,
    velocity FLOAT,
    status VARCHAR(20) DEFAULT 'normal',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- PHẦN 6: BẢNG CROWD_REPORTS (Báo cáo từ cộng đồng)
-- -----------------------------------------------------------------------------
CREATE TABLE crowd_reports (
    id SERIAL PRIMARY KEY,
    reporter_name VARCHAR(100),
    reporter_id VARCHAR(100),
    flood_level VARCHAR(50),
    location GEOGRAPHY(Point, 4326) NOT NULL,
    reliability_score FLOAT DEFAULT 50,
    validation_status VARCHAR(20) DEFAULT 'pending',
    verified_by_sensor BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- PHẦN 7: BẢNG USERS (Quản lý truy cập)
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    is_online BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON COLUMN users.is_online IS 'Trạng thái online: true khi đăng nhập, false khi đăng xuất';

-- -----------------------------------------------------------------------------
-- PHẦN 8: BẢNG ALERTS (Hệ thống cảnh báo)
-- -----------------------------------------------------------------------------
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(50) REFERENCES sensors(sensor_id) ON DELETE CASCADE,
    alert_type VARCHAR(20) NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium',
    message TEXT NOT NULL,
    water_level FLOAT,
    velocity FLOAT,
    status VARCHAR(20) DEFAULT 'active',
    acknowledged_by INTEGER REFERENCES users(id),
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- PHẦN 9: BẢNG REPORT_EVALUATIONS (Đánh giá tin báo)
-- -----------------------------------------------------------------------------
CREATE TABLE report_evaluations (
    id SERIAL PRIMARY KEY,
    report_id INTEGER REFERENCES crowd_reports(id) ON DELETE CASCADE,
    evaluator_id INTEGER REFERENCES users(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(report_id, evaluator_id)
);

-- -----------------------------------------------------------------------------
-- PHẦN 10: BỔ SUNG CỘT CHO CROWD_REPORTS
-- -----------------------------------------------------------------------------
ALTER TABLE crowd_reports
    ADD COLUMN IF NOT EXISTS photo_url TEXT,
    ADD COLUMN IF NOT EXISTS moderated_by INTEGER REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- -----------------------------------------------------------------------------
-- PHẦN 11: BẢNG EMERGENCY_SUBSCRIPTIONS (Đăng ký khẩn)
-- -----------------------------------------------------------------------------
CREATE TABLE emergency_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    radius INTEGER DEFAULT 1000,
    notification_methods VARCHAR(50)[] DEFAULT ARRAY['email', 'sms'],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- PHẦN 12: BẢNG OTA_UPDATES (Quản lý cập nhật firmware)
-- -----------------------------------------------------------------------------
CREATE TABLE ota_updates (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(50) REFERENCES sensors(sensor_id) ON DELETE CASCADE,
    firmware_version VARCHAR(50) NOT NULL,
    firmware_url TEXT NOT NULL,
    checksum VARCHAR(64),
    update_status VARCHAR(20) DEFAULT 'pending',
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- PHẦN 13: BẢNG ENERGY_LOGS (Theo dõi năng lượng)
-- -----------------------------------------------------------------------------
CREATE TABLE energy_logs (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(50) REFERENCES sensors(sensor_id) ON DELETE CASCADE,
    voltage FLOAT,
    current FLOAT,
    power FLOAT,
    battery_level INTEGER,
    power_source VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- PHẦN 14: BỔ SUNG CỘT CHO SENSORS
-- -----------------------------------------------------------------------------
ALTER TABLE sensors
    ADD COLUMN IF NOT EXISTS firmware_version VARCHAR(50),
    ADD COLUMN IF NOT EXISTS last_ota_update TIMESTAMP,
    ADD COLUMN IF NOT EXISTS battery_level INTEGER,
    ADD COLUMN IF NOT EXISTS power_source VARCHAR(20) DEFAULT 'grid';

-- -----------------------------------------------------------------------------
-- PHẦN 15: INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX idx_flood_logs_sensor_created ON flood_logs(sensor_id, created_at DESC);
CREATE INDEX idx_flood_logs_created ON flood_logs(created_at DESC);
CREATE INDEX idx_crowd_reports_location ON crowd_reports USING GIST(location);
CREATE INDEX idx_crowd_reports_created ON crowd_reports(created_at DESC);
CREATE INDEX idx_crowd_reports_moderation ON crowd_reports(moderation_status);
CREATE INDEX idx_sensors_coords ON sensors USING GIST(coords);

CREATE INDEX idx_alerts_sensor_created ON alerts(sensor_id, created_at DESC);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_report_evaluations_report ON report_evaluations(report_id);
CREATE INDEX idx_emergency_subscriptions_user ON emergency_subscriptions(user_id);
CREATE INDEX idx_emergency_subscriptions_location ON emergency_subscriptions USING GIST(location);
CREATE INDEX idx_ota_updates_sensor ON ota_updates(sensor_id, update_status);
CREATE INDEX idx_energy_logs_sensor_created ON energy_logs(sensor_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- PHẦN 16: DỮ LIỆU MẪU
-- -----------------------------------------------------------------------------
INSERT INTO sensors (sensor_id, location_name, coords, hardware_type, model, installation_date, installation_height)
VALUES ('S01', 'Cầu Sài Gòn - Bình Thạnh', ST_SetSRID(ST_MakePoint(106.721, 10.798), 4326)::geography, 'Wokwi_ESP32', 'HC-SR04', '2024-01-01', 150.0);

INSERT INTO sensor_thresholds (sensor_id, warning_threshold, danger_threshold, updated_by)
VALUES ('S01', 10, 30, 'system');

INSERT INTO users (username, email, password_hash, full_name, role)
VALUES ('admin', 'admin@hcm-flood.gov.vn', '$2b$10$placeholder', 'System Administrator', 'admin')
ON CONFLICT (username) DO NOTHING;

-- -----------------------------------------------------------------------------
-- PHẦN 17: FUNCTIONS & TRIGGERS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_and_create_alert()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('warning', 'danger') AND (OLD.status IS NULL OR OLD.status != NEW.status) THEN
        INSERT INTO alerts (sensor_id, alert_type, severity, message, water_level, velocity, status)
        VALUES (
            NEW.sensor_id,
            NEW.status,
            CASE WHEN NEW.status = 'danger' THEN 'critical' ELSE 'high' END,
            'Cảnh báo ngập lụt tại ' || (SELECT location_name FROM sensors WHERE sensor_id = NEW.sensor_id) ||
            ': Mực nước ' || ROUND(NEW.water_level::numeric, 2) || 'cm',
            NEW.water_level,
            NEW.velocity,
            'active'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_flood_log_alert
    AFTER INSERT ON flood_logs
    FOR EACH ROW
    EXECUTE FUNCTION check_and_create_alert();

CREATE OR REPLACE FUNCTION update_reliability_from_evaluations()
RETURNS TRIGGER AS $$
DECLARE
    avg_rating FLOAT;
    report_reliability FLOAT;
BEGIN
    SELECT AVG(rating) INTO avg_rating
    FROM report_evaluations
    WHERE report_id = NEW.report_id;

    IF avg_rating IS NOT NULL THEN
        report_reliability := (avg_rating / 5.0) * 100;
        UPDATE crowd_reports
        SET reliability_score = report_reliability
        WHERE id = NEW.report_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reliability
    AFTER INSERT OR UPDATE ON report_evaluations
    FOR EACH ROW
    EXECUTE FUNCTION update_reliability_from_evaluations();

-- =============================================================================
-- KẾT THÚC FULL SCHEMA
-- Lưu ý: Admin mặc định dùng password_hash placeholder - chạy script createAdminUser
-- để set mật khẩu thật (vd: npm run create-admin)
-- =============================================================================
