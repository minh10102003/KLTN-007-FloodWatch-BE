-- -----------------------------------------------------------------------------
-- Trạm Bình Quới (S03): installation_height = 75 cm (khớp firmware).
-- Chạy: npm run migrate:node-007-height-75  (script cập nhật S03)
-- -----------------------------------------------------------------------------

UPDATE sensors
SET installation_height = 75.0
WHERE sensor_id = 'S03';
