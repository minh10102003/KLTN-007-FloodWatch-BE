-- Vị trí GPS gần nhất (người dùng đã đăng nhập, FE gọi POST /api/auth/location sau khi được quyền truy cập vị trí).
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_known_lat DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_known_lng DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_location_accuracy_m DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_location_at TIMESTAMPTZ;

COMMENT ON COLUMN users.last_known_lat IS 'Vĩ độ WGS84 gần nhất (GPS), null = chưa gửi';
COMMENT ON COLUMN users.last_known_lng IS 'Kinh độ WGS84 gần nhất (GPS)';
COMMENT ON COLUMN users.last_location_accuracy_m IS 'Độ chính xác (m) từ Geolocation API, nếu có';
COMMENT ON COLUMN users.last_location_at IS 'Thời điểm cập nhật vị trí gần nhất';
