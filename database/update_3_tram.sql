-- Cập nhật 3 trạm (chạy trên DB đã có full_schema). Không phải full schema.

INSERT INTO sensors (sensor_id, location_name, coords, hardware_type, model, installation_date, installation_height)
VALUES
  ('S01', 'Trạm Xô Viết Nghệ Tĩnh', ST_SetSRID(ST_MakePoint(106.718, 10.812), 4326)::geography, 'Wokwi_ESP32', 'HC-SR04', '2024-01-01', 150.0),
  ('S03', 'Trạm Bình Quới', ST_SetSRID(ST_MakePoint(106.735, 10.828), 4326)::geography, 'Real_LoRa_Node', 'HC-SR04', '2024-01-01', 75.0),
  ('NODE_007', 'Trạm Vườn Lài', ST_SetSRID(ST_MakePoint(106.692, 10.848), 4326)::geography, 'Wokwi_ESP32', 'HC-SR04', '2024-01-01', 150.0)
ON CONFLICT (sensor_id) DO UPDATE SET
  location_name = EXCLUDED.location_name,
  coords = EXCLUDED.coords,
  installation_height = EXCLUDED.installation_height;

INSERT INTO sensor_thresholds (sensor_id, warning_threshold, danger_threshold, updated_by)
VALUES
  ('S01', 10, 30, 'system'),
  ('NODE_007', 10, 30, 'system'),
  ('S03', 10, 30, 'system')
ON CONFLICT (sensor_id) DO UPDATE SET
  warning_threshold = EXCLUDED.warning_threshold,
  danger_threshold = EXCLUDED.danger_threshold;
