# API lấy nhiệt độ & độ ẩm (DHT22) cho Frontend

## Endpoint chính xác để FE fetch

**URL (GET):**

```
{BASE_URL}/api/flood-data/realtime
```

Ví dụ:
- Local: `http://localhost:3000/api/flood-data/realtime`
- Production: `https://your-api.com/api/flood-data/realtime`

**Không cần auth** – endpoint công khai.

---

## Ví dụ gọi từ Frontend

### JavaScript (fetch)

```js
const BASE_URL = 'http://localhost:3000'; // hoặc env VITE_API_URL / REACT_APP_API_URL

const res = await fetch(`${BASE_URL}/api/flood-data/realtime`);
const json = await res.json();

if (json.success && Array.isArray(json.data)) {
  json.data.forEach((sensor) => {
    console.log(sensor.sensor_id, sensor.water_level, sensor.temperature, sensor.humidity);
    // temperature: số °C hoặc null
    // humidity: số % hoặc null
  });
}
```

### Query params (tùy chọn)

| Param | Mô tả |
|-------|--------|
| `sensor_id` | Chỉ lấy 1 sensor (filter phía BE nếu hỗ trợ) |
| `status` | Lọc theo trạng thái: `normal`, `warning`, `danger`, `offline` |
| `min_water_level` | Mực nước tối thiểu (cm) |
| `max_water_level` | Mực nước tối đa (cm) |

Ví dụ: `GET /api/flood-data/realtime?sensor_id=S01`

---

## Response 200 – cấu trúc

```json
{
  "success": true,
  "data": [
    {
      "sensor_id": "S01",
      "location_name": "Cầu Sài Gòn - Bình Thạnh",
      "model": "HC-SR04",
      "water_level": 35.5,
      "velocity": 1.2,
      "status": "warning",
      "lng": 106.721,
      "lat": 10.798,
      "warning_threshold": 10,
      "danger_threshold": 30,
      "last_data_time": "2025-03-12T10:00:00.000Z",
      "created_at": "2025-03-12T10:00:00.000Z",
      "temperature": 28.5,
      "humidity": 65
    }
  ]
}
```

| Field | Kiểu | Mô tả |
|-------|------|--------|
| `temperature` | `number \| null` | Nhiệt độ °C (DHT22). `null` nếu sensor chưa gửi. |
| `humidity` | `number \| null` | Độ ẩm % (DHT22). `null` nếu sensor chưa gửi. |

Các field khác (`sensor_id`, `water_level`, `status`, `lng`, `lat`, …) giữ như API flood hiện tại.

---

## Lưu ý

1. **Migration:** Backend phải chạy `npm run migrate:temperature-humidity` thì bảng `flood_logs` mới có cột `temperature`, `humidity`. Nếu chưa chạy, API có thể lỗi 500.
2. **Null:** Sensor chưa gắn DHT22 hoặc chưa gửi dữ liệu sẽ có `temperature: null`, `humidity: null`. FE nên hiển thị "--" hoặc ẩn khi null.
3. **Endpoint thay thế (cùng dữ liệu):** `GET /api/v1/flood-data/realtime` trả về giống hệt, FE có thể dùng một trong hai.
