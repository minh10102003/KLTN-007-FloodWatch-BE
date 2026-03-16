-- Thêm cột last_calibrated_at vào sensors (ghi nhận lần hiệu chuẩn cuối)
-- Chạy: psql -f database/add_last_calibrated_to_sensors.sql

ALTER TABLE sensors
ADD COLUMN IF NOT EXISTS last_calibrated_at TIMESTAMP;

COMMENT ON COLUMN sensors.last_calibrated_at IS 'Thời điểm admin thực hiện Calibrate Sensor lần cuối (ghi nhận từ POST /api/sensors/:id/calibrate)';
