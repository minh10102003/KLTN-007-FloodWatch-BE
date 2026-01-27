-- Script cập nhật installation_height cho sensor S01
-- Chạy script này nếu database đã tồn tại và cần cập nhật installation_height từ 100.0 lên 150.0

-- Cập nhật installation_height cho S01
UPDATE sensors 
SET installation_height = 150.0 
WHERE sensor_id = 'S01';

-- Kiểm tra kết quả
SELECT sensor_id, location_name, installation_height 
FROM sensors 
WHERE sensor_id = 'S01';
