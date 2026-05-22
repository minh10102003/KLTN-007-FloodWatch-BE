# Firmware ESP32 — LoRa + Gateway MQTT (mạch thật)

## File

| File | Vai trò |
|------|---------|
| **gateway_lora_mqtt.ino** | Gateway ESP32 + Ra-02 (SX1278): nhận LoRa CSV từ Node → publish JSON lên HiveMQ `hcm/flood/data` (TLS 8883). OLED I2C SDA21 SCL22. LoRa: SCK18, MISO19, MOSI23, NSS5, RST26, DIO04. |
| **sensor_node_lora.ino** | Node: median + Kalman, tính mực nước (cm), gửi LoRa `"Distance,WaterLevelCm,Percent,Status"` (vd `50,25.0,45,NORMAL`). |

Gateway map payload MQTT: `sensor_id` = **S03**, `value` = khoảng cách cm, `water_level` = mực nước cm (cột 2 CSV), tùy chọn `zone` (cột 4).

## Thư viện Arduino

- Gateway: WiFi, PubSubClient, Adafruit SSD1306, Adafruit GFX, SPI, Wire
- Node: LoRa (Sandeep Mistry), Adafruit SSD1306, Adafruit GFX, SPI, Wire

## Backend

- Topic: `hcm/flood/data`
- `mqttService` đọc `sensor_id`, `water_level` (cm, từ node), `value` (raw_distance, lưu DB); không tính lại mực nước trên BE
- DB: `sensor_id` = **S03** (Bình Quới)

## Lưu ý

- Sửa WiFi / MQTT trong **gateway_lora_mqtt.ino** trước khi nạp; không commit mật khẩu production vào repo public.
- **`MQTT_SENSOR_ID`** trong gateway phải trùng trạm trên bản đồ: `S03` = Bình Quới, `NODE_007` = Vườn Lài. Gửi `S03` nhưng xem `NODE_007` trên FE → hiển thị **Mất kết nối**.
- Payload MQTT cần có `water_level` (gateway mới). BE cũ chỉ có `value` vẫn chạy nhờ fallback.
- Dashboard **offline** sau ~5 phút không có `last_data_time` (cron health check). Backend Render phải chạy và subscribe HiveMQ.
