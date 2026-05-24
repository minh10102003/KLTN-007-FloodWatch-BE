-- Migration: thêm cột auto-approve cho bảng crowd_reports
-- (bảng báo cáo người dân — tên thực tế trong codebase, spec gọi là "reports")
-- Chạy: psql $DATABASE_URL -f migrations/add_auto_approve_fields.sql
--   hoặc npm run migrate:auto-approve (nếu có script)

ALTER TABLE crowd_reports
ADD COLUMN IF NOT EXISTS auto_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sensor_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS nearby_report_count INT DEFAULT 0;

COMMENT ON COLUMN crowd_reports.auto_approved IS
  'TRUE nếu báo cáo được duyệt tự động bởi auto-approve (>=5 báo cáo lân cận cùng flood_level)';

COMMENT ON COLUMN crowd_reports.sensor_verified IS
  'TRUE nếu có cảm biến xác minh trong khu vực (auto-approve flow). Khác verified_by_sensor (xác minh chéo lúc tạo)';

COMMENT ON COLUMN crowd_reports.nearby_report_count IS
  'Cache số báo cáo lân cận 100m cùng flood_level (tránh query nặng)';

-- Index lọc dashboard / summary (GIST location đã có: idx_crowd_reports_location)
CREATE INDEX IF NOT EXISTS idx_crowd_reports_auto_approved ON crowd_reports (auto_approved) WHERE auto_approved = TRUE;
CREATE INDEX IF NOT EXISTS idx_crowd_reports_sensor_verified ON crowd_reports (sensor_verified) WHERE sensor_verified = TRUE;
