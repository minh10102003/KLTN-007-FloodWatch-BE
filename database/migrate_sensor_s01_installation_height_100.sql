-- -----------------------------------------------------------------------------
-- Độ cao lắp cảm biến S01 = 100 cm (khớp firmware INSTALLATION_HEIGHT_CM và công thức backend).
-- Chạy: npm run migrate:s01-height-100
-- -----------------------------------------------------------------------------

UPDATE sensors
SET installation_height = 100.0
WHERE sensor_id = 'S01';
