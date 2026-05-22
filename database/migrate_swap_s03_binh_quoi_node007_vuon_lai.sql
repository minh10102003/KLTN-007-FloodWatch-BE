-- -----------------------------------------------------------------------------
-- Trạm Bình Quới = S03 (khớp HiveMQ). Vườn Lài = NODE_007.
-- Hoán đổi lịch sử + metadata; KHÔNG đổi PK sensors (tránh lỗi FK).
-- Chạy: npm run migrate:swap-s03-node007
-- -----------------------------------------------------------------------------

BEGIN;

DELETE FROM sensor_thresholds WHERE sensor_id = 'TEMP_BQ';
DELETE FROM sensors WHERE sensor_id = 'TEMP_BQ';

INSERT INTO sensors (
    sensor_id, location_name, coords, hardware_type, model,
    installation_date, installation_height, is_active
)
VALUES (
    'TEMP_BQ',
    'TEMP',
    ST_SetSRID(ST_MakePoint(0, 0), 4326)::geography,
    'temp',
    'temp',
    '2024-01-01',
    1.0,
    FALSE
);

-- Hoán đổi sensor_id trên bảng con (3 bước)
UPDATE flood_logs SET sensor_id = 'TEMP_BQ' WHERE sensor_id = 'NODE_007';
UPDATE flood_logs SET sensor_id = 'NODE_007' WHERE sensor_id = 'S03';
UPDATE flood_logs SET sensor_id = 'S03' WHERE sensor_id = 'TEMP_BQ';

UPDATE alerts SET sensor_id = 'TEMP_BQ' WHERE sensor_id = 'NODE_007';
UPDATE alerts SET sensor_id = 'NODE_007' WHERE sensor_id = 'S03';
UPDATE alerts SET sensor_id = 'S03' WHERE sensor_id = 'TEMP_BQ';

UPDATE ota_updates SET sensor_id = 'TEMP_BQ' WHERE sensor_id = 'NODE_007';
UPDATE ota_updates SET sensor_id = 'NODE_007' WHERE sensor_id = 'S03';
UPDATE ota_updates SET sensor_id = 'S03' WHERE sensor_id = 'TEMP_BQ';

UPDATE energy_logs SET sensor_id = 'TEMP_BQ' WHERE sensor_id = 'NODE_007';
UPDATE energy_logs SET sensor_id = 'NODE_007' WHERE sensor_id = 'S03';
UPDATE energy_logs SET sensor_id = 'S03' WHERE sensor_id = 'TEMP_BQ';

UPDATE road_edges SET flood_sensor_id = 'TEMP_BQ' WHERE flood_sensor_id = 'NODE_007';
UPDATE road_edges SET flood_sensor_id = 'NODE_007' WHERE flood_sensor_id = 'S03';
UPDATE road_edges SET flood_sensor_id = 'S03' WHERE flood_sensor_id = 'TEMP_BQ';

UPDATE emergency_alert_send_log SET sensor_id = 'TEMP_BQ' WHERE sensor_id = 'NODE_007';
UPDATE emergency_alert_send_log SET sensor_id = 'NODE_007' WHERE sensor_id = 'S03';
UPDATE emergency_alert_send_log SET sensor_id = 'S03' WHERE sensor_id = 'TEMP_BQ';

UPDATE sensor_thresholds SET sensor_id = 'TEMP_BQ' WHERE sensor_id = 'NODE_007';
UPDATE sensor_thresholds SET sensor_id = 'NODE_007' WHERE sensor_id = 'S03';
UPDATE sensor_thresholds SET sensor_id = 'S03' WHERE sensor_id = 'TEMP_BQ';

DELETE FROM sensors WHERE sensor_id = 'TEMP_BQ';

-- Metadata trên sensors (id giữ nguyên)
UPDATE sensors
SET
    location_name = 'Trạm Bình Quới',
    coords = ST_SetSRID(ST_MakePoint(106.735, 10.828), 4326)::geography,
    hardware_type = 'Real_LoRa_Node',
    model = 'HC-SR04',
    installation_height = 75.0
WHERE sensor_id = 'S03';

UPDATE sensors
SET
    location_name = 'Trạm Vườn Lài',
    coords = ST_SetSRID(ST_MakePoint(106.692, 10.848), 4326)::geography,
    hardware_type = 'Wokwi_ESP32',
    model = 'HC-SR04',
    installation_height = 75.0
WHERE sensor_id = 'NODE_007';

INSERT INTO sensor_thresholds (sensor_id, warning_threshold, danger_threshold, updated_by)
VALUES ('S03', 10, 30, 'system')
ON CONFLICT (sensor_id) DO NOTHING;

INSERT INTO sensor_thresholds (sensor_id, warning_threshold, danger_threshold, updated_by)
VALUES ('NODE_007', 10, 30, 'system')
ON CONFLICT (sensor_id) DO NOTHING;

COMMIT;
