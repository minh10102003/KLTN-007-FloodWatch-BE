-- -----------------------------------------------------------------------------
-- Đổi vị trí bản đồ S01 → Nguyễn Thái Sơn, Phường 4 (gần ĐH Công nghiệp), Gò Vấp.
-- Chỉ sensor_id S01; NODE_007 / S03 không đổi.
-- Chạy: npm run migrate:s01-location
-- -----------------------------------------------------------------------------

UPDATE sensors
SET
    location_name = 'Nguyễn Thái Sơn, Phường 4, Hạnh Thông, TP.HCM',
    coords = ST_SetSRID(ST_MakePoint(106.68066, 10.81655), 4326)::geography
WHERE sensor_id = 'S01';
