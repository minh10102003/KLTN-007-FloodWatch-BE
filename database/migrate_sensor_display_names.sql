-- -----------------------------------------------------------------------------
-- Đổi tên hiển thị trạm (location_name) — giữ nguyên sensor_id (S01, NODE_007, S03).
-- 01 / S01  → Trạm Xô Viết Nghệ Tĩnh
-- 02 / S03  → Trạm Bình Quới (MQTT S03)
-- 03 / NODE_007 → Trạm Vườn Lài
-- Chạy: npm run migrate:sensor-display-names
-- -----------------------------------------------------------------------------

UPDATE sensors SET location_name = 'Trạm Xô Viết Nghệ Tĩnh' WHERE sensor_id = 'S01';

UPDATE sensors SET location_name = 'Trạm Bình Quới'
WHERE sensor_id IN ('S02', 'S03');

UPDATE sensors SET location_name = 'Trạm Vườn Lài' WHERE sensor_id IN ('NODE_007');
