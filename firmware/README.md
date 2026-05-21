# Firmware ESP32 — LoRa + Gateway MQTT (mạch thật)

## File

| File | Vai trò |
|------|---------|
| **gateway_lora_mqtt.ino** | Gateway ESP32 + Ra-02 (SX1278): nhận LoRa CSV từ Node → publish JSON lên HiveMQ `hcm/flood/data` (TLS 8883). OLED I2C SDA21 SCL22. LoRa: SCK18, MISO19, MOSI23, NSS5, RST26, DIO04. |
| **sensor_node_lora.ino** | Node ESP32 + Ra-02 + JSN-SR04T: đo khoảng cách, gửi LoRa dạng `"Distance,Percent,Status"` (vd `30,81,OK`). LoRa: SCK18, MISO19, MOSI32, NSS15, RST26, DIO04. HC-SR04: TRIG27, ECHO13. |

Gateway map payload MQTT: `sensor_id` = **NODE_007**, `value` = khoảng cách cm (cột đầu CSV) — khớp bảng `sensors` trong DB Neon.

## Thư viện Arduino

- Gateway: WiFi, PubSubClient, Adafruit SSD1306, Adafruit GFX, SPI, Wire
- Node: LoRa (Sandeep Mistry), Adafruit SSD1306, Adafruit GFX, SPI, Wire

## Backend

- Topic: `hcm/flood/data`
- `mqttService` đọc `sensor_id` + `value` (raw_distance cm), tính `water_level` = `installation_height - value`
- DB: `sensor_id` = `NODE_007` (trước đây S02 — migration `npm run migrate:s02-node-007`)

## Lưu ý

- Sửa WiFi / MQTT trong **gateway_lora_mqtt.ino** trước khi nạp; không commit mật khẩu production vào repo public.
- Node firmware `INSTALLATION_HEIGHT` = **75 cm** → cập nhật `sensors.installation_height = 75` cho `NODE_007` trên Neon để BE tính `water_level` khớp thực tế (`src/utils/ultrasonicWaterLevel.js`).
