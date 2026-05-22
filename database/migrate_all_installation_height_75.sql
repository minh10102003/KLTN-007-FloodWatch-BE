-- -----------------------------------------------------------------------------
-- Đồng bộ installation_height = 75 cm cho mọi trạm (trước đó S01/NODE_007 = 150).
-- Chạy: npm run migrate:installation-height-75-all
-- -----------------------------------------------------------------------------

UPDATE sensors
SET installation_height = 75.0
WHERE installation_height = 150.0
   OR installation_height > 75.0;
