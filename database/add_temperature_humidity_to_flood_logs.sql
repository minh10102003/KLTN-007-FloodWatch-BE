-- Thêm cột nhiệt độ và độ ẩm vào flood_logs (từ cảm biến DHT22)
-- Chạy: npm run migrate:temperature-humidity  hoặc  psql -f database/add_temperature_humidity_to_flood_logs.sql

ALTER TABLE flood_logs
ADD COLUMN IF NOT EXISTS temperature FLOAT;
COMMENT ON COLUMN flood_logs.temperature IS 'Nhiệt độ (°C) từ DHT22, optional';

ALTER TABLE flood_logs
ADD COLUMN IF NOT EXISTS humidity FLOAT;
COMMENT ON COLUMN flood_logs.humidity IS 'Độ ẩm (%) từ DHT22, optional';
