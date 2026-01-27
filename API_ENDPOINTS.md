# API Endpoints Documentation

Base URL: `http://localhost:3000`

## 📊 Flood Data APIs

### 1. GET /api/v1/flood-data/realtime ⭐ (KHUYẾN NGHỊ CHO FRONTEND)
**Mô tả:** Lấy dữ liệu real-time với đầy đủ trạng thái, velocity, và ngưỡng báo động

**Response Example:**
```json
{
  "success": true,
  "data": [
    {
      "sensor_id": "S01",
      "location_name": "Cầu Sài Gòn - Bình Thạnh",
      "model": "HC-SR04",
      "sensor_status": "warning",
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

**Trạng thái (status):**
- `normal`: < 10cm (mặc định) hoặc < warning_threshold
- `warning`: 10-30cm (mặc định) hoặc >= warning_threshold và < danger_threshold
- `danger`: > 30cm (mặc định) hoặc >= danger_threshold
- `offline`: Không có dữ liệu > 5 phút

**Các trường:**
- `sensor_id`: ID của cảm biến
- `water_level`: Mực nước (cm) = installation_height - raw_distance
- `velocity`: Vận tốc nước dâng (cm/phút) - so sánh với 5 phút trước
- `status`: Trạng thái hiện tại
- `warning_threshold`: Ngưỡng cảnh báo (cm)
- `danger_threshold`: Ngưỡng nguy hiểm (cm)

---

### 2. GET /api/v1/flood-data
**Mô tả:** Lấy dữ liệu ngập lụt kèm thông tin sensor (bản ghi mới nhất cho mỗi sensor)

**Response Example:**
```json
{
  "success": true,
  "data": [
    {
      "sensor_id": "S01",
      "water_level": 25.5,
      "velocity": 1.2,
      "status": "warning",
      "created_at": "2026-01-27T10:30:00.000Z",
      "location_name": "Cầu Sài Gòn - Bình Thạnh",
      "model": "HC-SR04",
      "installation_height": 100.0,
      "last_data_time": "2026-01-27T10:30:00.000Z",
      "lng": 106.721,
      "lat": 10.798
    }
  ]
}
```

---

### 3. GET /api/flood-history
**Mô tả:** Lấy tất cả dữ liệu ngập lụt (giới hạn 100 bản ghi mới nhất) - API cũ

**Response Example:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "sensor_id": "S01",
      "raw_distance": 74.5,
      "water_level": 25.5,
      "velocity": 1.2,
      "status": "warning",
      "created_at": "2026-01-27T10:30:00.000Z"
    }
  ]
}
```

---

### 4. GET /api/sensors/:sensorId/history
**Mô tả:** Lấy lịch sử dữ liệu cho một sensor cụ thể

**Parameters:**
- `sensorId`: ID của sensor
- `limit` (query): Số lượng bản ghi (mặc định: 100)

**Response Example:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "sensor_id": "S01",
      "raw_distance": 74.5,
      "water_level": 25.5,
      "velocity": 1.2,
      "status": "warning",
      "created_at": "2026-01-27T10:30:00.000Z"
    }
  ]
}
```

---

## 👥 Crowd Reports APIs

### 5. GET /api/crowd-reports
**Mô tả:** Lấy các báo cáo từ người dân trong vòng 24 giờ qua

**Response Example:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "reporter_name": "Nguyễn Văn A",
      "reporter_id": "user_123",
      "flood_level": "Nặng",
      "reliability_score": 75.5,
      "validation_status": "cross_verified",
      "verified_by_sensor": true,
      "lng": 106.701,
      "lat": 10.776,
      "created_at": "2026-01-27T09:15:00.000Z"
    }
  ]
}
```

**Trạng thái xác minh (validation_status):**
- `pending`: Chờ kiểm tra
- `verified`: Đã xác minh
- `cross_verified`: Đã xác minh chéo với sensor
- `rejected`: Bị từ chối

---

### 6. GET /api/crowd-reports/all
**Mô tả:** Lấy tất cả báo cáo (không giới hạn thời gian)

**Query Parameters:**
- `limit`: Số lượng bản ghi (mặc định: 100)

**Response:** Tương tự như `/api/crowd-reports`

---

### 7. POST /api/report-flood
**Mô tả:** Tạo báo cáo ngập lụt mới từ người dùng (với xác minh chéo tự động)

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

**Mức độ ngập (level):**
- `Nhẹ`: Đến mắt cá (~10cm)
- `Trung bình`: Đến đầu gối (~30cm)
- `Nặng`: Ngập nửa xe (~50cm)

**Response Success:**
```json
{
  "success": true,
  "message": "Báo cáo của bạn đã được xác minh bởi hệ thống cảm biến. Cảm ơn!",
  "data": {
    "validation_status": "cross_verified",
    "verified_by_sensor": true
  }
}
```

**Response Error:**
```json
{
  "success": false,
  "error": "Mức độ ngập không hợp lệ. Chọn: Nhẹ, Trung bình, hoặc Nặng"
}
```

**Logic xác minh chéo:**
- Nếu sensor trong bán kính 500m báo ngập VÀ người dân báo ngập → `cross_verified`
- Nếu chỉ có người dân báo mà sensor báo bình thường → `pending`
- Điểm tin cậy (reliability_score) được cập nhật tự động: +5 nếu chính xác, -10 nếu sai

---

## 🔧 Sensor Management APIs

### 8. GET /api/sensors
**Mô tả:** Lấy tất cả sensors với thông tin đầy đủ

**Response Example:**
```json
{
  "success": true,
  "data": [
    {
      "sensor_id": "S01",
      "location_name": "Cầu Sài Gòn - Bình Thạnh",
      "model": "HC-SR04",
      "hardware_type": "Wokwi_ESP32",
      "installation_date": "2024-01-01",
      "installation_height": 100.0,
      "is_active": true,
      "status": "warning",
      "last_data_time": "2026-01-27T10:30:00.000Z",
      "lng": 106.721,
      "lat": 10.798,
      "warning_threshold": 10,
      "danger_threshold": 30,
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### 9. GET /api/sensors/:sensorId
**Mô tả:** Lấy thông tin một sensor cụ thể

**Response:** Tương tự như GET /api/sensors (một object)

---

### 10. POST /api/sensors
**Mô tả:** Tạo sensor mới

**Request Body:**
```json
{
  "sensor_id": "S02",
  "location_name": "Ngã tư Điện Biên Phủ",
  "lng": 106.700,
  "lat": 10.800,
  "hardware_type": "ESP32",
  "model": "HC-SR04",
  "installation_date": "2024-01-15",
  "installation_height": 120.0,
  "warning_threshold": 15,
  "danger_threshold": 35
}
```

**Required Fields:**
- `sensor_id`: ID duy nhất của sensor
- `location_name`: Tên vị trí
- `lng`: Kinh độ
- `lat`: Vĩ độ
- `installation_height`: Độ cao lắp đặt (cm)

**Response:**
```json
{
  "success": true,
  "message": "Tạo sensor thành công",
  "data": { ... }
}
```

---

### 11. PUT /api/sensors/:sensorId
**Mô tả:** Cập nhật thông tin sensor

**Request Body:** (Tất cả các trường đều optional)
```json
{
  "location_name": "Cầu Sài Gòn - Bình Thạnh (Updated)",
  "lng": 106.722,
  "lat": 10.799,
  "hardware_type": "ESP32",
  "model": "HC-SR04",
  "installation_date": "2024-01-01",
  "installation_height": 105.0,
  "is_active": true
}
```

---

### 12. PUT /api/sensors/:sensorId/thresholds
**Mô tả:** Cập nhật ngưỡng báo động cho sensor (Dynamic Thresholds)

**Request Body:**
```json
{
  "warning_threshold": 15,
  "danger_threshold": 35,
  "updated_by": "admin_user"
}
```

**Validation:**
- `warning_threshold` phải nhỏ hơn `danger_threshold`

**Response:**
```json
{
  "success": true,
  "message": "Cập nhật ngưỡng báo động thành công",
  "data": {
    "id": 1,
    "sensor_id": "S01",
    "warning_threshold": 15,
    "danger_threshold": 35,
    "updated_at": "2026-01-27T10:30:00.000Z",
    "updated_by": "admin_user"
  }
}
```

---

### 13. DELETE /api/sensors/:sensorId
**Mô tả:** Xóa sensor (cascade delete: xóa cả flood_logs và thresholds)

**Response:**
```json
{
  "success": true,
  "message": "Xóa sensor thành công"
}
```

---

## 📋 Tóm tắt Endpoints

| Method | Endpoint | Mô tả | Trạng thái |
|--------|----------|-------|------------|
| GET | `/api/v1/flood-data/realtime` | Dữ liệu real-time ⭐ | ✅ |
| GET | `/api/v1/flood-data` | Dữ liệu sensor (mới) | ✅ |
| GET | `/api/flood-history` | Dữ liệu sensor (cũ) | ⚠️ |
| GET | `/api/sensors/:sensorId/history` | Lịch sử sensor | ✅ |
| GET | `/api/crowd-reports` | Báo cáo 24h | ✅ |
| GET | `/api/crowd-reports/all` | Tất cả báo cáo | ✅ |
| POST | `/api/report-flood` | Tạo báo cáo | ✅ |
| GET | `/api/sensors` | Danh sách sensors | ✅ |
| GET | `/api/sensors/:sensorId` | Chi tiết sensor | ✅ |
| POST | `/api/sensors` | Tạo sensor | ✅ |
| PUT | `/api/sensors/:sensorId` | Cập nhật sensor | ✅ |
| PUT | `/api/sensors/:sensorId/thresholds` | Cập nhật ngưỡng | ✅ |
| DELETE | `/api/sensors/:sensorId` | Xóa sensor | ✅ |

---

## 🎯 Khuyến nghị cho Frontend

### 1. Hiển thị bản đồ real-time
**Sử dụng:** `GET /api/v1/flood-data/realtime`

**Lý do:**
- ✅ Có đầy đủ trạng thái (normal/warning/danger/offline)
- ✅ Có velocity (vận tốc nước dâng)
- ✅ Có ngưỡng báo động động
- ✅ Có last_data_time để hiển thị "Mất kết nối"

**Mapping trạng thái → màu sắc:**
- `normal`: Xanh lá (#28a745)
- `warning`: Vàng (#ffc107)
- `danger`: Đỏ (#dc3545) - Nháy marker
- `offline`: Xám (#6c757d)

### 2. Form báo cáo ngập
**Sử dụng:** `POST /api/report-flood`

**Fields:**
- `name`: Tên người báo cáo (required)
- `reporter_id`: ID người dùng (optional, để tính điểm tin cậy)
- `level`: "Nhẹ" | "Trung bình" | "Nặng" (required)
- `lng`, `lat`: Tọa độ (required)

**Hiển thị kết quả:**
- Nếu `verified_by_sensor = true` → Hiển thị badge "Đã xác minh"
- Nếu `validation_status = pending` → Hiển thị "Đang xem xét"

### 3. Dashboard Admin
**Sử dụng:**
- `GET /api/sensors` - Quản lý sensors
- `PUT /api/sensors/:sensorId/thresholds` - Cập nhật ngưỡng báo động

---

## 🔄 Nghiệp vụ đã triển khai

### ✅ Quản lý Hạ tầng & Thiết bị (IoT Management)
- [x] Định danh trạm đo (Sensor Identity)
- [x] Số hóa vị trí (Geo-Spatial Mapping) với PostGIS
- [x] Cấu hình thông số vật lý (Physical Calibration) - installation_height
- [x] Thiết lập ngưỡng báo động động (Dynamic Thresholds)

### ✅ Giám sát & Phân tích Real-time
- [x] Thu thập dữ liệu từ MQTT
- [x] Lọc nhiễu dữ liệu (loại bỏ 0cm hoặc >500cm)
- [x] Tính toán mực nước: `water_level = installation_height - raw_distance`
- [x] Giám sát trạng thái kết nối (Health Check - 5 phút)
- [x] Phân tích vận tốc nước dâng (so sánh T và T-5 phút)

### ✅ Tương tác Cộng đồng (Crowdsourcing)
- [x] Báo cáo hiện trường (Incident Reporting)
- [x] Xác minh chéo (Data Validation) với sensor trong bán kính 500m
- [x] Hệ thống điểm tin cậy (Reliability Score)

### ⏳ Cảnh báo & Điều hành (Dispatcher)
- [x] Xác định trạng thái dựa trên ngưỡng
- [ ] Push Notification (cần tích hợp service)
- [ ] Social Bot (Telegram/Zalo) - cần tích hợp
- [ ] Trực quan hóa Bản đồ Nhiệt (Flood Heatmap) - PostGIS interpolation
- [ ] Kết xuất báo cáo (Reporting) - tổng hợp thời gian ngập, đỉnh ngập

---

## 📝 Ghi chú kỹ thuật

### Tính toán mực nước
```
Mực nước (water_level) = Độ cao lắp đặt (installation_height) - Khoảng cách đo được (raw_distance)
```

### Lọc nhiễu
- Loại bỏ giá trị <= 0cm hoặc > 500cm
- Giá trị đột biến sẽ bị từ chối và không lưu vào database

### Health Check
- Chạy mỗi 1 phút
- Sensor không có dữ liệu > 5 phút → status = 'offline'

### Xác minh chéo
- Tìm sensor trong bán kính 500m
- Nếu sensor báo ngập (warning/danger) VÀ người dân báo ngập → `cross_verified`
- Nếu chỉ người dân báo mà sensor bình thường → `pending`