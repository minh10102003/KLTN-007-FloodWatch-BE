-- -----------------------------------------------------------------------------
-- NODE_007: installation_height = 75 cm (khớp firmware sensor_node_lora.ino
-- và src/utils/ultrasonicWaterLevel.js — công thức water_level = H - distance).
-- Chạy: npm run migrate:node-007-height-75
-- -----------------------------------------------------------------------------

UPDATE sensors
SET installation_height = 75.0
WHERE sensor_id = 'NODE_007';
