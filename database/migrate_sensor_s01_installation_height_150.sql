-- -----------------------------------------------------------------------------
-- S01 giả lập Wokwi: installation_height = 150 cm (khớp INSTALL_HEIGHT firmware).
-- Backend: water_level = installation_height − value (MQTT chỉ gửi value).
-- Chạy: npm run migrate:s01-height-150
-- -----------------------------------------------------------------------------

UPDATE sensors
SET
    installation_height = 150.0,
    hardware_type = 'Wokwi_ESP32',
    is_active = TRUE
WHERE sensor_id = 'S01';

INSERT INTO sensor_thresholds (sensor_id, warning_threshold, danger_threshold, updated_by)
VALUES ('S01', 10, 30, 'system')
ON CONFLICT (sensor_id) DO UPDATE SET
    warning_threshold = EXCLUDED.warning_threshold,
    danger_threshold = EXCLUDED.danger_threshold,
    updated_at = CURRENT_TIMESTAMP;
