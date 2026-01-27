# 🚀 Quick Reference - API Endpoints

## ✅ Endpoints đã được xác nhận hoạt động

### 📊 Flood Data APIs

#### 1. GET `/api/v1/flood-data/realtime` ⭐ **KHUYẾN NGHỊ CHO FRONTEND**
**Mô tả:** Lấy dữ liệu real-time với đầy đủ trạng thái, velocity, và ngưỡng báo động

**URL đầy đủ:** `http://localhost:3000/api/v1/flood-data/realtime`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "sensor_id": "S01",
      "location_name": "Cầu Sài Gòn - Bình Thạnh",
      "model": "HC-SR04",
      "water_level": 15.5,
      "velocity": 2.3,
      "status": "warning",
      "lng": 106.721,
      "lat": 10.798,
      "warning_threshold": 10,
      "danger_threshold": 30,
      "last_data_time": "2026-01-27T10:30:00.000Z",
      "created_at": "2026-01-27T10:30:00.000Z"
    }
  ]
}
```

**Status values:**
- `normal`: < warning_threshold
- `warning`: >= warning_threshold và < danger_threshold
- `danger`: >= danger_threshold
- `offline`: Không có dữ liệu > 5 phút

---

#### 2. GET `/api/v1/flood-data`
**Mô tả:** Lấy dữ liệu ngập lụt kèm thông tin sensor (bản ghi mới nhất cho mỗi sensor)

**URL đầy đủ:** `http://localhost:3000/api/v1/flood-data`

---

#### 3. GET `/api/flood-history`
**Mô tả:** Lấy tất cả dữ liệu ngập lụt (API cũ - giữ để tương thích)

**URL đầy đủ:** `http://localhost:3000/api/flood-history`

---

#### 4. GET `/api/sensors/:sensorId/history`
**Mô tả:** Lấy lịch sử dữ liệu cho một sensor cụ thể

**URL đầy đủ:** `http://localhost:3000/api/sensors/S01/history?limit=100`

**Query params:**
- `limit` (optional): Số lượng bản ghi (mặc định: 100)

---

### 👥 Crowd Reports APIs

#### 5. POST `/api/report-flood`
**Mô tả:** Tạo báo cáo ngập lụt mới từ người dùng

**URL đầy đủ:** `http://localhost:3000/api/report-flood`

**Request Body:**
```json
{
  "name": "Nguyễn Văn A",
  "reporter_id": "user_123",
  "level": "Nặng",
  "lng": 106.701,
  "lat": 10.776
}
```

**Valid levels:** `"Nhẹ"`, `"Trung bình"`, `"Nặng"`

---

#### 6. GET `/api/crowd-reports`
**Mô tả:** Lấy các báo cáo từ người dân trong vòng 24 giờ qua

**URL đầy đủ:** `http://localhost:3000/api/crowd-reports`

---

#### 7. GET `/api/crowd-reports/all`
**Mô tả:** Lấy tất cả báo cáo (không giới hạn thời gian)

**URL đầy đủ:** `http://localhost:3000/api/crowd-reports/all?limit=100`

**Query params:**
- `limit` (optional): Số lượng bản ghi (mặc định: 100)

---

### 🔧 Sensor Management APIs

#### 8. GET `/api/sensors`
**Mô tả:** Lấy tất cả sensors với thông tin đầy đủ

**URL đầy đủ:** `http://localhost:3000/api/sensors`

---

#### 9. GET `/api/sensors/:sensorId`
**Mô tả:** Lấy thông tin một sensor cụ thể

**URL đầy đủ:** `http://localhost:3000/api/sensors/S01`

---

#### 10. POST `/api/sensors`
**Mô tả:** Tạo sensor mới

**URL đầy đủ:** `http://localhost:3000/api/sensors`

---

#### 11. PUT `/api/sensors/:sensorId`
**Mô tả:** Cập nhật thông tin sensor

**URL đầy đủ:** `http://localhost:3000/api/sensors/S01`

---

#### 12. PUT `/api/sensors/:sensorId/thresholds`
**Mô tả:** Cập nhật ngưỡng báo động cho sensor

**URL đầy đủ:** `http://localhost:3000/api/sensors/S01/thresholds`

**Request Body:**
```json
{
  "warning_threshold": 15,
  "danger_threshold": 35,
  "updated_by": "admin_user"
}
```

---

#### 13. DELETE `/api/sensors/:sensorId`
**Mô tả:** Xóa sensor

**URL đầy đủ:** `http://localhost:3000/api/sensors/S01`

---

## 🔍 Test Endpoints

### Sử dụng cURL:
```bash
# Test realtime endpoint
curl http://localhost:3000/api/v1/flood-data/realtime

# Test crowd reports
curl http://localhost:3000/api/crowd-reports

# Test create report
curl -X POST http://localhost:3000/api/report-flood \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","level":"Nhẹ","lng":106.701,"lat":10.776}'
```

### Sử dụng JavaScript/Fetch:
```javascript
// Test realtime endpoint
fetch('http://localhost:3000/api/v1/flood-data/realtime')
  .then(res => res.json())
  .then(data => console.log(data));

// Test create report
fetch('http://localhost:3000/api/report-flood', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Test User',
    level: 'Nhẹ',
    lng: 106.701,
    lat: 10.776
  })
})
  .then(res => res.json())
  .then(data => console.log(data));
```

---

## ⚠️ Lưu ý quan trọng

1. **Base URL:** `http://localhost:3000` (hoặc URL server của bạn)
2. **CORS:** Đã được bật, Frontend có thể gọi từ domain khác
3. **Content-Type:** `application/json` cho POST/PUT requests
4. **Error Response:** Tất cả lỗi đều trả về format:
   ```json
   {
     "success": false,
     "error": "Error message here"
   }
   ```

---

## 🐛 Troubleshooting

### Lỗi 404 Not Found
- ✅ Kiểm tra server đã chạy chưa: `npm start` hoặc `node server.js`
- ✅ Kiểm tra endpoint có đúng không (copy từ danh sách trên)
- ✅ Kiểm tra base URL có đúng không

### Lỗi CORS
- ✅ Đã được bật trong `src/app.js`, không cần cấu hình thêm

### Lỗi 500 Internal Server Error
- ✅ Kiểm tra database đã kết nối chưa
- ✅ Kiểm tra `.env` file có đầy đủ thông tin không
- ✅ Xem logs trong console của server

---

**Cập nhật lần cuối:** 2026-01-27
