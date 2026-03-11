-- 3 trạm cảm biến tại 3 cung đường khả năng ngập cao nhất (TP.HCM)
-- Chạy sau full_schema.sql. Cập nhật S01 + thêm S02, S03.
-- Tọa độ tham khảo (lng, lat) WGS84.

INSERT INTO sensors (sensor_id, location_name, coords, hardware_type, model, installation_date, installation_height)
VALUES
  ('S01', 'Nguyễn Hữu Cảnh - Đoạn trũng cầu vượt', ST_SetSRID(ST_MakePoint(106.718, 10.812), 4326)::geography, 'Wokwi_ESP32', 'HC-SR04', '2024-01-01', 150.0),
  ('S02', 'Bình Quới (P.28) - Triều cường, mưa', ST_SetSRID(ST_MakePoint(106.735, 10.828), 4326)::geography, 'Wokwi_ESP32', 'HC-SR04', '2024-01-01', 150.0),
  ('S03', 'Ung Văn Khiêm - Đinh Bộ Lĩnh - QL13', ST_SetSRID(ST_MakePoint(106.692, 10.848), 4326)::geography, 'Wokwi_ESP32', 'HC-SR04', '2024-01-01', 150.0)
ON CONFLICT (sensor_id) DO UPDATE SET
  location_name = EXCLUDED.location_name,
  coords = EXCLUDED.coords,
  installation_height = EXCLUDED.installation_height;

INSERT INTO sensor_thresholds (sensor_id, warning_threshold, danger_threshold, updated_by)
VALUES
  ('S01', 10, 30, 'system'),
  ('S02', 10, 30, 'system'),
  ('S03', 10, 30, 'system')
ON CONFLICT (sensor_id) DO UPDATE SET
  warning_threshold = EXCLUDED.warning_threshold,
  danger_threshold = EXCLUDED.danger_threshold;
