-- =============================================================================
-- HCM FLOOD BACKEND - FULL DATABASE SCHEMA (TỔNG HỢP)
-- Tạo toàn bộ cấu trúc + dữ liệu khởi tạo cho project hiện tại.
-- Chạy trên DB mới để có đầy đủ bảng, cột, index, trigger, seed data.
--
-- Ví dụ chạy:
--   psql -U <user> -d <dbname> -f database/schema.sql
-- Hoặc cấu hình npm script để chạy file này.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PHẦN 1: XÓA ĐỐI TƯỢNG CŨ (THEO THỨ TỰ PHỤ THUỘC)
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trigger_flood_log_alert ON flood_logs;
DROP TRIGGER IF EXISTS trigger_update_reliability ON report_evaluations;

DROP TABLE IF EXISTS report_evaluations;
DROP TABLE IF EXISTS emergency_subscriptions;
DROP TABLE IF EXISTS ota_updates;
DROP TABLE IF EXISTS energy_logs;
DROP TABLE IF EXISTS alerts;
DROP TABLE IF EXISTS access_logs;
DROP TABLE IF EXISTS audit_logs;
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
-- PHẦN 3: BẢNG USERS (QUẢN LÝ TRUY CẬP)
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'user',
    reporter_reliability FLOAT DEFAULT 50,
    is_active BOOLEAN DEFAULT TRUE,
    is_online BOOLEAN DEFAULT FALSE,
    avatar VARCHAR(100),
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_user_role CHECK (role IN ('user', 'moderator', 'admin'))
);

COMMENT ON COLUMN users.is_online IS 'Trạng thái online: true khi đăng nhập, false khi đăng xuất';
COMMENT ON COLUMN users.reporter_reliability IS 'Điểm tin cậy khi là người báo cáo (0-100). Cách C: cập nhật theo sự kiện + có thể tính lại từ lịch sử.';
COMMENT ON COLUMN users.avatar IS 'Tên file ảnh đại diện (profile icon), VD: cat.png. Chỉ được chọn từ danh sách icon có sẵn.';
COMMENT ON CONSTRAINT chk_user_role ON users IS 'Chỉ cho phép role: user, moderator, admin';

-- -----------------------------------------------------------------------------
-- PHẦN 4: BẢNG SENSORS (DANH MỤC TRẠM)
-- -----------------------------------------------------------------------------
CREATE TABLE sensors (
    sensor_id VARCHAR(50) PRIMARY KEY,
    location_name VARCHAR(100) NOT NULL,
    coords GEOGRAPHY(Point, 4326) NOT NULL,
    hardware_type VARCHAR(20),
    model VARCHAR(50),
    installation_date DATE,
    installation_height FLOAT NOT NULL DEFAULT 0,
    last_calibrated_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    last_data_time TIMESTAMP,
    status VARCHAR(20) DEFAULT 'normal',
    firmware_version VARCHAR(50),
    last_ota_update TIMESTAMP,
    battery_level INTEGER,
    power_source VARCHAR(20) DEFAULT 'grid',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON COLUMN sensors.last_calibrated_at IS 'Thời điểm admin thực hiện Calibrate Sensor lần cuối (ghi nhận từ POST /api/sensors/:id/calibrate)';

-- -----------------------------------------------------------------------------
-- PHẦN 5: BẢNG SENSOR_THRESHOLDS (NGƯỠNG BÁO ĐỘNG)
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
-- PHẦN 6: BẢNG FLOOD_LOGS (DỮ LIỆU MỰC NƯỚC)
-- -----------------------------------------------------------------------------
CREATE TABLE flood_logs (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(50) REFERENCES sensors(sensor_id) ON DELETE CASCADE,
    raw_distance FLOAT,
    water_level FLOAT NOT NULL,
    velocity FLOAT,
    temperature FLOAT,
    humidity FLOAT,
    status VARCHAR(20) DEFAULT 'normal',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON COLUMN flood_logs.temperature IS 'Nhiệt độ (°C) từ DHT22, optional';
COMMENT ON COLUMN flood_logs.humidity IS 'Độ ẩm (%) từ DHT22, optional';

-- -----------------------------------------------------------------------------
-- PHẦN 7: BẢNG CROWD_REPORTS (BÁO CÁO TỪ CỘNG ĐỒNG)
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
    content VARCHAR(500),
    photo_url TEXT,
    photo_urls JSONB DEFAULT '[]'::jsonb,
    moderated_by INTEGER REFERENCES users(id),
    moderated_at TIMESTAMP,
    moderation_status VARCHAR(20) DEFAULT 'pending',
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON COLUMN crowd_reports.content IS 'Nội dung mô tả mức độ ngập (tùy chọn, tối đa 500 ký tự)';
COMMENT ON COLUMN crowd_reports.photo_url IS 'URL ảnh hiện trường ngập (lưu từ upload, vd: /uploads/xxx.jpg)';
COMMENT ON COLUMN crowd_reports.photo_urls IS 'Mảng URL ảnh (JSON array), tối đa 5 ảnh; photo_url = ảnh đầu để tương thích';

-- -----------------------------------------------------------------------------
-- PHẦN 8: BẢNG ALERTS (HỆ THỐNG CẢNH BÁO)
-- -----------------------------------------------------------------------------
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(50) REFERENCES sensors(sensor_id) ON DELETE CASCADE,
    alert_type VARCHAR(20) NOT NULL, -- 'warning', 'danger', 'offline', 'velocity_spike'
    severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    message TEXT NOT NULL,
    water_level FLOAT,
    velocity FLOAT,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'acknowledged', 'resolved'
    acknowledged_by INTEGER REFERENCES users(id),
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- PHẦN 9: BẢNG REPORT_EVALUATIONS (ĐÁNH GIÁ TIN BÁO)
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
-- PHẦN 10: BẢNG EMERGENCY_SUBSCRIPTIONS (ĐĂNG KÝ KHẨN)
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
-- PHẦN 11: BẢNG OTA_UPDATES (QUẢN LÝ CẬP NHẬT FIRMWARE)
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
-- PHẦN 12: BẢNG ENERGY_LOGS (THEO DÕI NĂNG LƯỢNG)
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
-- PHẦN 13: BẢNG ACCESS_LOGS (LƯỢT TRUY CẬP API)
-- -----------------------------------------------------------------------------
CREATE TABLE access_logs (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    path VARCHAR(500)
);

COMMENT ON TABLE access_logs IS 'Lượt truy cập API – middleware ghi mỗi request';

-- -----------------------------------------------------------------------------
-- PHẦN 14: BẢNG AUDIT_LOGS (NHẬT KÝ THAO TÁC ADMIN)
-- -----------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(100),
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);

COMMENT ON TABLE audit_logs IS 'Nhật ký thao tác Admin: sensor, user role/active, xóa dữ liệu';

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
CREATE INDEX idx_access_logs_created_at ON access_logs(created_at);

-- -----------------------------------------------------------------------------
-- PHẦN 16: DỮ LIỆU MẪU (SENSORS, THRESHOLDS, ADMIN USER)
-- -----------------------------------------------------------------------------
-- 3 trạm cảm biến chính (S01-S03)
INSERT INTO sensors (sensor_id, location_name, coords, hardware_type, model, installation_date, installation_height)
VALUES
  ('S01', 'Nguyễn Hữu Cảnh - Đoạn trũng cầu vượt', ST_SetSRID(ST_MakePoint(106.718, 10.812), 4326)::geography, 'Wokwi_ESP32', 'HC-SR04', '2024-01-01', 150.0),
  ('S02', 'Bình Quới (P.28) - Triều cường, mưa', ST_SetSRID(ST_MakePoint(106.735, 10.828), 4326)::geography, 'Wokwi_ESP32', 'HC-SR04', '2024-01-01', 150.0),
  ('S03', 'Ung Văn Khiêm - Đinh Bộ Lĩnh - QL13', ST_SetSRID(ST_MakePoint(106.692, 10.848), 4326)::geography, 'Wokwi_ESP32', 'HC-SR04', '2024-01-01', 150.0)
ON CONFLICT (sensor_id) DO UPDATE SET
  location_name = EXCLUDED.location_name,
  coords = EXCLUDED.coords,
  installation_height = EXCLUDED.installation_height;

INSERT INTO sensor_thresholds (sensor_id, warning_threshold, danger_threshold, updated_by)
VALUES
  ('S01', 10, 30, 'system'),
  ('S02', 10, 30, 'system'),
  ('S03', 10, 30, 'system')
ON CONFLICT (sensor_id) DO UPDATE SET
  warning_threshold = EXCLUDED.warning_threshold,
  danger_threshold = EXCLUDED.danger_threshold;

-- Admin mặc định (password_hash placeholder, sẽ được cập nhật bằng script createAdminUser)
INSERT INTO users (username, email, password_hash, full_name, role, reporter_reliability)
VALUES ('admin', 'admin@hcm-flood.gov.vn', '$2b$10$placeholder', 'System Administrator', 'admin', 50)
ON CONFLICT (username) DO NOTHING;

-- -----------------------------------------------------------------------------
-- PHẦN 17: FUNCTIONS & TRIGGERS
-- -----------------------------------------------------------------------------
-- Function: tự động tạo ALERT khi flood_logs có status warning/danger
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

-- Function: cập nhật reliability_score của crowd_reports từ report_evaluations
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
-- Sau khi tạo DB mới bằng file này, nên chạy script Node createAdminUser
-- để set password thực tế cho tài khoản admin.
-- =============================================================================

