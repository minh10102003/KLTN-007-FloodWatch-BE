-- -----------------------------------------------------------------------------
-- Migration: đổi sensor_id S02 → NODE_007 (khớp MQTT {"sensor_id":"NODE_007","value":...})
-- Giữ vị trí Bình Quới (P.28), chuyển metadata sang mạch thật LoRa/MQTT.
-- Chạy: npm run migrate:s02-node-007
-- -----------------------------------------------------------------------------

BEGIN;

-- 1) Tạo trạm NODE_007 từ bản ghi S02 (nếu chưa có NODE_007)
INSERT INTO sensors (
    sensor_id,
    location_name,
    coords,
    hardware_type,
    model,
    installation_date,
    installation_height,
    is_active,
    status,
    firmware_version,
    power_source,
    last_calibrated_at,
    last_data_time,
    battery_level,
    last_ota_update,
    created_at
)
SELECT
    'NODE_007',
    'Bình Quới (P.28) - NODE_007 (LoRa/MQTT)',
    coords,
    'Real_LoRa_Node',
    model,
    installation_date,
    COALESCE(NULLIF(installation_height, 0), 150.0),
    TRUE,
    status,
    firmware_version,
    power_source,
    last_calibrated_at,
    last_data_time,
    battery_level,
    last_ota_update,
    created_at
FROM sensors
WHERE sensor_id = 'S02'
  AND NOT EXISTS (SELECT 1 FROM sensors WHERE sensor_id = 'NODE_007');

-- 2) Cập nhật metadata nếu NODE_007 đã tồn tại
UPDATE sensors SET
    location_name = 'Bình Quới (P.28) - NODE_007 (LoRa/MQTT)',
    hardware_type = 'Real_LoRa_Node',
    is_active = TRUE,
    installation_height = COALESCE(NULLIF(installation_height, 0), 150.0)
WHERE sensor_id = 'NODE_007';

-- 3) Ngưỡng cảnh báo
INSERT INTO sensor_thresholds (sensor_id, warning_threshold, danger_threshold, updated_by)
SELECT 'NODE_007', warning_threshold, danger_threshold, updated_by
FROM sensor_thresholds
WHERE sensor_id = 'S02'
ON CONFLICT (sensor_id) DO UPDATE SET
    warning_threshold = EXCLUDED.warning_threshold,
    danger_threshold = EXCLUDED.danger_threshold,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO sensor_thresholds (sensor_id, warning_threshold, danger_threshold, updated_by)
VALUES ('NODE_007', 10, 30, 'system')
ON CONFLICT (sensor_id) DO NOTHING;

-- 4) Chuyển dữ liệu liên quan S02 → NODE_007
UPDATE flood_logs SET sensor_id = 'NODE_007' WHERE sensor_id = 'S02';
UPDATE alerts SET sensor_id = 'NODE_007' WHERE sensor_id = 'S02';
UPDATE ota_updates SET sensor_id = 'NODE_007' WHERE sensor_id = 'S02';
UPDATE energy_logs SET sensor_id = 'NODE_007' WHERE sensor_id = 'S02';
UPDATE road_edges SET flood_sensor_id = 'NODE_007' WHERE flood_sensor_id = 'S02';
UPDATE emergency_alert_send_log SET sensor_id = 'NODE_007' WHERE sensor_id = 'S02';

-- 5) Xóa S02
DELETE FROM sensor_thresholds WHERE sensor_id = 'S02';
DELETE FROM sensors WHERE sensor_id = 'S02';

COMMIT;
