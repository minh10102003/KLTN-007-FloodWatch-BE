-- Tham chiếu retention (BE tự chạy qua dataRetentionService hoặc: npm run db:retention)
-- Giữ flood_logs + energy_logs 48h (chỉnh SENSOR_LOG_RETENTION_HOURS trên Render)

-- Ví dụ chạy tay trên Neon SQL Editor:
-- DELETE FROM flood_logs WHERE created_at < NOW() - INTERVAL '48 hours';
-- DELETE FROM energy_logs WHERE created_at < NOW() - INTERVAL '48 hours';
