-- Migration: Thêm các bảng mới cho các chức năng từ Use Case
-- Chạy file này sau khi đã có schema.sql

-- 1. Bảng USERS (Quản lý truy cập)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'user', -- 'user', 'admin', 'moderator'
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng ALERTS (Hệ thống cảnh báo)
CREATE TABLE IF NOT EXISTS alerts (
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

-- 3. Bảng REPORT_EVALUATIONS (Đánh giá tin báo)
CREATE TABLE IF NOT EXISTS report_evaluations (
    id SERIAL PRIMARY KEY,
    report_id INTEGER REFERENCES crowd_reports(id) ON DELETE CASCADE,
    evaluator_id INTEGER REFERENCES users(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- 1-5 sao
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(report_id, evaluator_id) -- Mỗi user chỉ đánh giá 1 lần
);

-- 4. Thêm cột vào CROWD_REPORTS
ALTER TABLE crowd_reports 
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS moderated_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 5. Bảng EMERGENCY_SUBSCRIPTIONS (Đăng ký khẩn)
CREATE TABLE IF NOT EXISTS emergency_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    radius INTEGER DEFAULT 1000, -- Bán kính (mét) để nhận cảnh báo
    notification_methods VARCHAR(50)[] DEFAULT ARRAY['email', 'sms'], -- 'email', 'sms', 'push'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Bảng OTA_UPDATES (Quản lý cập nhật OTA)
CREATE TABLE IF NOT EXISTS ota_updates (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(50) REFERENCES sensors(sensor_id) ON DELETE CASCADE,
    firmware_version VARCHAR(50) NOT NULL,
    firmware_url TEXT NOT NULL,
    checksum VARCHAR(64), -- SHA256 checksum
    update_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Bảng ENERGY_LOGS (Theo dõi năng lượng - cho mạch thật)
CREATE TABLE IF NOT EXISTS energy_logs (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(50) REFERENCES sensors(sensor_id) ON DELETE CASCADE,
    voltage FLOAT, -- Điện áp (V)
    current FLOAT, -- Dòng điện (mA)
    power FLOAT, -- Công suất (mW)
    battery_level INTEGER, -- Mức pin (%)
    power_source VARCHAR(20), -- 'battery', 'solar', 'grid'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Thêm cột vào SENSORS cho các tính năng mới
ALTER TABLE sensors 
ADD COLUMN IF NOT EXISTS firmware_version VARCHAR(50),
ADD COLUMN IF NOT EXISTS last_ota_update TIMESTAMP,
ADD COLUMN IF NOT EXISTS battery_level INTEGER,
ADD COLUMN IF NOT EXISTS power_source VARCHAR(20) DEFAULT 'grid';

-- 9. Tạo indexes
CREATE INDEX IF NOT EXISTS idx_alerts_sensor_created ON alerts(sensor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_report_evaluations_report ON report_evaluations(report_id);
CREATE INDEX IF NOT EXISTS idx_emergency_subscriptions_user ON emergency_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_subscriptions_location ON emergency_subscriptions USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_ota_updates_sensor ON ota_updates(sensor_id, update_status);
CREATE INDEX IF NOT EXISTS idx_energy_logs_sensor_created ON energy_logs(sensor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crowd_reports_moderation ON crowd_reports(moderation_status);

-- 10. Tạo user admin mặc định (password: admin123 - cần hash trong code)
-- Password hash sẽ được tạo trong code khi register/login
INSERT INTO users (username, email, password_hash, full_name, role) 
VALUES ('admin', 'admin@hcm-flood.gov.vn', '$2b$10$placeholder', 'System Administrator', 'admin')
ON CONFLICT (username) DO NOTHING;

-- 11. Tạo function để tự động tạo alert khi vượt ngưỡng
CREATE OR REPLACE FUNCTION check_and_create_alert()
RETURNS TRIGGER AS $$
BEGIN
    -- Tạo alert khi status thay đổi sang warning hoặc danger
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

-- 12. Tạo trigger để tự động tạo alert
DROP TRIGGER IF EXISTS trigger_flood_log_alert ON flood_logs;
CREATE TRIGGER trigger_flood_log_alert
    AFTER INSERT ON flood_logs
    FOR EACH ROW
    EXECUTE FUNCTION check_and_create_alert();

-- 13. Tạo function để cập nhật điểm tin cậy dựa trên đánh giá
CREATE OR REPLACE FUNCTION update_reliability_from_evaluations()
RETURNS TRIGGER AS $$
DECLARE
    avg_rating FLOAT;
    report_reliability FLOAT;
BEGIN
    -- Tính điểm trung bình từ các đánh giá
    SELECT AVG(rating) INTO avg_rating
    FROM report_evaluations
    WHERE report_id = NEW.report_id;
    
    IF avg_rating IS NOT NULL THEN
        -- Chuyển đổi rating (1-5) sang reliability_score (0-100)
        -- 5 sao = 100, 4 sao = 80, 3 sao = 60, 2 sao = 40, 1 sao = 20
        report_reliability := (avg_rating / 5.0) * 100;
        
        -- Cập nhật reliability_score của report
        UPDATE crowd_reports
        SET reliability_score = report_reliability
        WHERE id = NEW.report_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 14. Tạo trigger để cập nhật reliability khi có đánh giá mới
DROP TRIGGER IF EXISTS trigger_update_reliability ON report_evaluations;
CREATE TRIGGER trigger_update_reliability
    AFTER INSERT OR UPDATE ON report_evaluations
    FOR EACH ROW
    EXECUTE FUNCTION update_reliability_from_evaluations();

