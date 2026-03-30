-- -----------------------------------------------------------------------------
-- Migration: S01 từ giả lập (Wokwi) → mạch thật (Node LoRa + Gateway → HiveMQ).
-- Backend/FE không đổi: vẫn sensor_id 'S01', topic hcm/flood/data.
--
-- Trước khi chạy production: chỉnh installation_height (cm) và tọa độ nếu lắp khác seed.
-- Cột hardware_type tối đa 20 ký tự — giữ ngắn gọn.
-- -----------------------------------------------------------------------------

UPDATE sensors SET
    location_name = 'Nguyễn Hữu Cảnh - S01 (mạch thật LoRa/MQTT)',
    hardware_type = 'Real_ESP32_LoRa',
    model = 'HC-SR04',
    installation_date = COALESCE(installation_date, DATE '2024-01-01'),
    installation_height = COALESCE(NULLIF(installation_height, 0), 100.0),
    is_active = TRUE
WHERE sensor_id = 'S01';

-- Đảm bảo có ngưỡng (giống S02/S03)
INSERT INTO sensor_thresholds (sensor_id, warning_threshold, danger_threshold, updated_by)
VALUES ('S01', 10, 30, 'system')
ON CONFLICT (sensor_id) DO UPDATE SET
    warning_threshold = EXCLUDED.warning_threshold,
    danger_threshold = EXCLUDED.danger_threshold,
    updated_at = CURRENT_TIMESTAMP;

-- Tùy chọn: cập nhật tọa độ lắp thật (mở comment và sửa lng/lat)
-- UPDATE sensors SET
--   coords = ST_SetSRID(ST_MakePoint(106.718, 10.812), 4326)::geography
-- WHERE sensor_id = 'S01';
