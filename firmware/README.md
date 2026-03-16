# Firmware ESP32 – Cảm biến ngập + DHT22 (Wokwi)

- **esp32_flood_dht22.ino**: Code Arduino cho ESP32 với HC-SR04 (mực nước) + DHT22 (nhiệt độ, độ ẩm). Gửi MQTT topic `hcm/flood/data` với payload có `sensor_id`, `value` (raw_distance), `temperature`, `humidity` (nếu đọc được).
- **diagram.json**: Sơ đồ Wokwi (ESP32, HC-SR04, LCD I2C, DHT22). DHT22 Data nối **D4**.

## Wokwi

1. Tạo project mới tại [wokwi.com](https://wokwi.com) (ESP32).
2. Thay nội dung file **diagram.json** của project bằng nội dung trong thư mục này (hoặc import diagram).
3. Thay code **main.ino** bằng **esp32_flood_dht22.ino**.
4. Thêm thư viện: **DHT sensor library by Adafruit** (trong Wokwi: Libraries → Add → tìm "DHT" hoặc "Adafruit DHT").
5. Chạy simulation; MQTT sẽ gửi cả `temperature` và `humidity` khi DHT22 đọc được.

## Chân nối DHT22

| DHT22 | ESP32 |
|-------|--------|
| VCC   | 3V3    |
| GND   | GND    |
| SDA (Data) | **D4** (GPIO 4) |

## Backend

- Chạy migration: `npm run migrate:temperature-humidity` để thêm cột `temperature`, `humidity` vào bảng `flood_logs`.
- Subscriber MQTT đã xử lý payload có `temperature`, `humidity` và lưu vào DB.
