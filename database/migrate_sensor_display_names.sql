-- -----------------------------------------------------------------------------
-- Đổi tên hiển thị trạm (location_name) — giữ nguyên sensor_id (S01, NODE_007, S03).
-- 01 / S01  → Trạm Xô Viết Nghệ Tĩnh
-- 02 / S02 / NODE_007 → Trạm Bình Quới
-- 03 / S03  → Trạm Vườn Lài
-- Chạy: npm run migrate:sensor-display-names
-- -----------------------------------------------------------------------------

UPDATE sensors SET location_name = 'Trạm Xô Viết Nghệ Tĩnh' WHERE sensor_id = 'S01';

UPDATE sensors SET location_name = 'Trạm Bình Quới'
WHERE sensor_id IN ('S02', 'NODE_007');

UPDATE sensors SET location_name = 'Trạm Vườn Lài' WHERE sensor_id = 'S03';
