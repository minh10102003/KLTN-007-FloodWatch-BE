-- =============================================================================
-- FIX SEQUENCES - Reset tất cả sequence về đúng giá trị sau khi restore backup
-- Chạy script này sau khi import full_backup để fix lỗi duplicate key
-- =============================================================================

-- Reset sequence cho access_logs
SELECT setval('access_logs_id_seq', COALESCE((SELECT MAX(id) FROM access_logs), 1), true);

-- Reset sequence cho audit_logs
SELECT setval('audit_logs_id_seq', COALESCE((SELECT MAX(id) FROM audit_logs), 1), true);

-- Reset sequence cho alerts
SELECT setval('alerts_id_seq', COALESCE((SELECT MAX(id) FROM alerts), 1), true);

-- Reset sequence cho crowd_reports
SELECT setval('crowd_reports_id_seq', COALESCE((SELECT MAX(id) FROM crowd_reports), 1), true);

-- Reset sequence cho emergency_subscriptions
SELECT setval('emergency_subscriptions_id_seq', COALESCE((SELECT MAX(id) FROM emergency_subscriptions), 1), true);

-- Reset sequence cho energy_logs
SELECT setval('energy_logs_id_seq', COALESCE((SELECT MAX(id) FROM energy_logs), 1), true);

-- Reset sequence cho flood_logs
SELECT setval('flood_logs_id_seq', COALESCE((SELECT MAX(id) FROM flood_logs), 1), true);

-- Reset sequence cho ota_updates
SELECT setval('ota_updates_id_seq', COALESCE((SELECT MAX(id) FROM ota_updates), 1), true);

-- Reset sequence cho report_evaluations
SELECT setval('report_evaluations_id_seq', COALESCE((SELECT MAX(id) FROM report_evaluations), 1), true);

-- Reset sequence cho sensor_thresholds
SELECT setval('sensor_thresholds_id_seq', COALESCE((SELECT MAX(id) FROM sensor_thresholds), 1), true);

-- Reset sequence cho users
SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1), true);

-- =============================================================================
-- KẾT THÚC
-- Sau khi chạy script này, các sequence sẽ được reset về đúng giá trị
-- và lỗi duplicate key sẽ không còn xảy ra nữa.
-- =============================================================================
