-- Migration: 5 mức ngập (Mức 1–5) thay cho Nhẹ / Trung bình / Nặng (và số 1–3 cũ)
-- Chạy: npm run migrate:flood-levels

UPDATE crowd_reports SET flood_level = 'Mức 1'
WHERE flood_level IN ('Nhẹ', '1', 'mức 1', 'Muc 1', 'MUC 1');

UPDATE crowd_reports SET flood_level = 'Mức 2'
WHERE flood_level IN ('2', 'mức 2', 'Muc 2');

UPDATE crowd_reports SET flood_level = 'Mức 3'
WHERE flood_level IN ('Trung bình', '3', 'mức 3', 'Muc 3');

UPDATE crowd_reports SET flood_level = 'Mức 4'
WHERE flood_level IN ('4', 'mức 4', 'Muc 4');

UPDATE crowd_reports SET flood_level = 'Mức 5'
WHERE flood_level IN ('Nặng', '5', 'mức 5', 'Muc 5');

COMMENT ON COLUMN crowd_reports.flood_level IS
  'Mức ngập: Mức 1 (10cm), Mức 2 (20cm), Mức 3 (30cm), Mức 4 (40cm), Mức 5 (>50cm)';

-- Hàm SQL dùng chung (optional cho query/report)
CREATE OR REPLACE FUNCTION crowd_flood_level_to_cm(level text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE TRIM(level)
        WHEN 'Mức 1' THEN 10
        WHEN 'Mức 2' THEN 20
        WHEN 'Mức 3' THEN 30
        WHEN 'Mức 4' THEN 40
        WHEN 'Mức 5' THEN 55
        WHEN 'Nhẹ' THEN 10
        WHEN 'Trung bình' THEN 30
        WHEN 'Nặng' THEN 50
        WHEN '1' THEN 10
        WHEN '2' THEN 20
        WHEN '3' THEN 30
        WHEN '4' THEN 40
        WHEN '5' THEN 55
        ELSE 0
    END;
$$;
