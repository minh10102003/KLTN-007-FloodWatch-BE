-- Điểm tin cậy người báo cáo (Cách C: nền từ thống kê + cập nhật theo sự kiện)
-- Giá trị 0-100, mặc định 50
ALTER TABLE users ADD COLUMN IF NOT EXISTS reporter_reliability FLOAT DEFAULT 50;

-- Ràng buộc (chỉ áp dụng nếu muốn - có thể bỏ qua để tránh lỗi với dữ liệu cũ)
-- ALTER TABLE users ADD CONSTRAINT chk_reporter_reliability CHECK (reporter_reliability >= 0 AND reporter_reliability <= 100);

-- Cập nhật các row cũ có NULL thành 50
UPDATE users SET reporter_reliability = 50 WHERE reporter_reliability IS NULL;

COMMENT ON COLUMN users.reporter_reliability IS 'Điểm tin cậy khi là người báo cáo (0-100). Cách C: cập nhật theo sự kiện (approved/rejected/cross_verified) + có thể tính lại từ lịch sử.';
