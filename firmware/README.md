# Firmware ESP32

## File

| File | Vai trò |
|------|---------|
| **wokwi_sensor_s01_sim.ino** | **S01 giả lập Wokwi**: MQTT trực tiếp HiveMQ, `value` = khoảng cách giả lập (150→20 cm), DHT22. BE tính `water_level = installation_height − value` (DB S01 = **150 cm**). Chạy `npm run migrate:s01-height-150` trước khi test. |
| **lora_sensor_s01.ino** | Node LoRa S01: chỉ đo khoảng cách (cm), gửi LoRa `S01,<distance>`. |
| **gateway_lora_mqtt.ino** | Gateway: nhận LoRa → MQTT `{"sensor_id":"S01","value":<distance>}`. Không tính water_level. |
| **sensor_node_lora.ino** | Node LoRa legacy (S03…): CSV có water_level; BE vẫn ưu tiên tính từ `value` nếu có. |

Gateway S01: chỉ forward `sensor_id` + `value` (khoảng cách cm tới vật cản).

## Thư viện Arduino

- Gateway: WiFi, PubSubClient, Adafruit SSD1306, Adafruit GFX, SPI, Wire
- Node: LoRa (Sandeep Mistry), Adafruit SSD1306, Adafruit GFX, SPI, Wire

## Backend

- Topic: `hcm/flood/data`
- **S01 (Wokwi / LoRa)**: payload chỉ `value` = khoảng cách cm; BE tính `water_level = installation_height − value` (S01 DB = 150 cm).

## Lưu ý

- Sửa WiFi / MQTT trong **gateway_lora_mqtt.ino** trước khi nạp; không commit mật khẩu production vào repo public.
- **`MQTT_SENSOR_ID`** trong gateway phải trùng trạm trên bản đồ: `S03` = Bình Quới, `NODE_007` = Vườn Lài. Gửi `S03` nhưng xem `NODE_007` trên FE → hiển thị **Mất kết nối**.
- Payload MQTT **không cần** `water_level` — BE tự tính từ `value` + `installation_height`.
- Dashboard **offline** sau ~5 phút không có `last_data_time` (cron health check). Backend Render phải chạy và subscribe HiveMQ.
