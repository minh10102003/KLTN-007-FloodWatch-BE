# 📚 API Reference - HCM Flood Warning System

## 📋 Mục Lục
1. [HTTP Status Codes](#http-status-codes)
2. [Authentication APIs](#authentication-apis)
3. [Sensor APIs](#sensor-apis)
4. [Flood Data APIs](#flood-data-apis)
5. [Crowd Report APIs](#crowd-report-apis)
6. [Alert APIs](#alert-apis)
7. [Report Moderation APIs](#report-moderation-apis)
8. [Report Evaluation APIs](#report-evaluation-apis)
9. [Emergency Subscription APIs](#emergency-subscription-apis)
10. [Heatmap APIs](#heatmap-apis)
11. [OTA Update APIs](#ota-update-apis)
12. [Energy Monitoring APIs](#energy-monitoring-apis)

---

## 🔢 HTTP Status Codes

| Code | Tên | Mô Tả | Khi Nào Sử Dụng |
|------|-----|-------|-----------------|
| **200** | OK | Thành công | GET, PUT, DELETE thành công |
| **201** | Created | Đã tạo thành công | POST tạo resource mới |
| **400** | Bad Request | Yêu cầu không hợp lệ | Thiếu/sai tham số, validation lỗi |
| **401** | Unauthorized | Chưa xác thực | Thiếu token hoặc token không hợp lệ |
| **403** | Forbidden | Không có quyền | User không có quyền thực hiện |
| **404** | Not Found | Không tìm thấy | Resource không tồn tại |
| **500** | Internal Server Error | Lỗi server | Lỗi database, code, hoặc hệ thống |

---

## 🔐 Authentication APIs

### 1. Đăng ký
```http
POST /api/auth/register
Content-Type: application/json
```

**Request Body:**
```json
{
  "username": "user123",
  "email": "user@example.com",
  "password": "password123",
  "full_name": "Nguyễn Văn A",
  "phone": "0123456789"
}
```

**Response 201 (Created):**
```json
{
  "success": true,
  "message": "Đăng ký thành công",
  "data": {
    "user": {
      "id": 1,
      "username": "user123",
      "email": "user@example.com",
      "full_name": "Nguyễn Văn A",
      "phone": "0123456789",
      "role": "user",
      "is_active": true,
      "created_at": "2024-12-20T10:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response 400 (Bad Request):**
```json
{
  "success": false,
  "error": "Thiếu thông tin bắt buộc: username, email, password"
}
```

**Response 400 (Username đã tồn tại):**
```json
{
  "success": false,
  "error": "Username đã tồn tại"
}
```

---

### 2. Đăng nhập
```http
POST /api/auth/login
Content-Type: application/json
```

**Request Body:**
```json
{
  "username": "user123",
  "password": "password123"
}
```

**Response 200 (OK):**
```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": {
    "user": {
      "id": 1,
      "username": "user123",
      "email": "user@example.com",
      "full_name": "Nguyễn Văn A",
      "role": "user",
      "is_active": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response 401 (Unauthorized):**
```json
{
  "success": false,
  "error": "Username hoặc password không đúng"
}
```

**Response 400 (Bad Request):**
```json
{
  "success": false,
  "error": "Thiếu thông tin: username, password"
}
```

---

### 3. Lấy thông tin profile
```http
GET /api/auth/profile
Authorization: Bearer <token>
```

**Response 200 (OK):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "user123",
    "email": "user@example.com",
    "full_name": "Nguyễn Văn A",
    "phone": "0123456789",
    "role": "user",
    "is_active": true,
    "last_login": "2024-12-20T10:00:00.000Z",
    "created_at": "2024-12-19T10:00:00.000Z"
  }
}
```

**Response 401 (Unauthorized):**
```json
{
  "success": false,
  "error": "Token không được cung cấp"
}
```

---

### 4. Cập nhật profile
```http
PUT /api/auth/profile
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "full_name": "Nguyễn Văn B",
  "phone": "0987654321",
  "email": "newemail@example.com"
}
```

**Response 200 (OK):**
```json
{
  "success": true,
  "message": "Cập nhật profile thành công",
  "data": {
    "id": 1,
    "username": "user123",
    "email": "newemail@example.com",
    "full_name": "Nguyễn Văn B",
    "phone": "0987654321",
    "role": "user",
    "is_active": true
  }
}
```

---

### 5. Đổi mật khẩu
```http
PUT /api/auth/change-password
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "old_password": "password123",
  "new_password": "newpassword456"
}
```

**Response 200 (OK):**
```json
{
  "success": true,
  "message": "Đổi mật khẩu thành công"
}
```

**Response 400 (Bad Request):**
```json
{
  "success": false,
  "error": "Mật khẩu cũ không đúng"
}
```

---

## 📡 Sensor APIs

### 1. Lấy tất cả sensors
```http
GET /api/sensors
```

**Response 200 (OK):**
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
      "installation_height": 150,
      "is_active": true,
      "status": "normal",
      "last_data_time": "2024-12-20T10:00:00.000Z",
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

### 2. Lấy sensor theo ID
```http
GET /api/sensors/:sensorId
```

**Response 200 (OK):**
```json
{
  "success": true,
  "data": {
    "sensor_id": "S01",
    "location_name": "Cầu Sài Gòn - Bình Thạnh",
    "model": "HC-SR04",
    "hardware_type": "Wokwi_ESP32",
    "installation_height": 150,
    "is_active": true,
    "status": "normal",
    "lng": 106.721,
    "lat": 10.798,
    "warning_threshold": 10,
    "danger_threshold": 30
  }
}
```

**Response 404 (Not Found):**
```json
{
  "success": false,
  "error": "Sensor không tồn tại"
}
```

---

### 3. Tạo sensor mới
```http
POST /api/sensors
Content-Type: application/json
```

**Request Body:**
```json
{
  "sensor_id": "S02",
  "location_name": "Ngã Tư Hàng Xanh",
  "lng": 106.700,
  "lat": 10.800,
  "hardware_type": "ESP32",
  "model": "HC-SR04",
  "installation_date": "2024-12-20",
  "installation_height": 120,
  "warning_threshold": 10,
  "danger_threshold": 30
}
```

**Response 201 (Created):**
```json
{
  "success": true,
  "message": "Tạo sensor thành công",
  "data": {
    "sensor_id": "S02",
    "location_name": "Ngã Tư Hàng Xanh",
    "lng": 106.700,
    "lat": 10.800,
    "installation_height": 120,
    "warning_threshold": 10,
    "danger_threshold": 30
  }
}
```

**Response 400 (Bad Request):**
```json
{
  "success": false,
  "error": "Thiếu thông tin bắt buộc: sensor_id, location_name, lng, lat, installation_height"
}
```

**Response 400 (Sensor ID đã tồn tại):**
```json
{
  "success": false,
  "error": "Sensor ID đã tồn tại"
}
```

---

### 4. Cập nhật sensor
```http
PUT /api/sensors/:sensorId
Content-Type: application/json
```

**Request Body:**
```json
{
  "location_name": "Cầu Sài Gòn - Cập nhật",
  "is_active": false
}
```

**Response 200 (OK):**
```json
{
  "success": true,
  "message": "Cập nhật sensor thành công",
  "data": {
    "sensor_id": "S01",
    "location_name": "Cầu Sài Gòn - Cập nhật",
    "is_active": false
  }
}
```

**Response 404 (Not Found):**
```json
{
  "success": false,
  "error": "Sensor không tồn tại"
}
```

---

### 5. Cập nhật ngưỡng báo động
```http
PUT /api/sensors/:sensorId/thresholds
Content-Type: application/json
```

**Request Body:**
```json
{
  "warning_threshold": 15,
  "danger_threshold": 35,
  "updated_by": "admin"
}
```

**Response 200 (OK):**
```json
{
  "success": true,
  "message": "Cập nhật ngưỡng báo động thành công",
  "data": {
    "sensor_id": "S01",
    "warning_threshold": 15,
    "danger_threshold": 35,
    "updated_by": "admin",
    "updated_at": "2024-12-20T10:00:00.000Z"
  }
}
```

**Response 400 (Bad Request):**
```json
{
  "success": false,
  "error": "warning_threshold phải nhỏ hơn danger_threshold"
}
```

---

### 6. Xóa sensor
```http
DELETE /api/sensors/:sensorId
```

**Response 200 (OK):**
```json
{
  "success": true,
  "message": "Xóa sensor thành công"
}
```

---

## 🌊 Flood Data APIs

### 1. Lấy dữ liệu real-time
```http
GET /api/v1/flood-data/realtime
```

**Response 200 (OK):**
```json
{
  "success": true,
  "data": [
    {
      "sensor_id": "S01",
      "location_name": "Cầu Sài Gòn - Bình Thạnh",
      "model": "HC-SR04",
      "water_level": 5.5,
      "velocity": 0.2,
      "status": "normal",
      "lng": 106.721,
      "lat": 10.798,
      "warning_threshold": 10,
      "danger_threshold": 30,
      "last_data_time": "2024-12-20T10:00:00.000Z",
      "created_at": "2024-12-20T10:00:00.000Z"
    }
  ]
}
```

---

### 2. Lấy lịch sử theo sensor
```http
GET /api/sensors/:sensorId/history?limit=100
```

**Response 200 (OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "sensor_id": "S01",
      "raw_distance": 144.5,
      "water_level": 5.5,
      "velocity": 0.2,
      "status": "normal",
      "created_at": "2024-12-20T10:00:00.000Z"
    }
  ]
}
```

---

## 📝 Crowd Report APIs

### 1. Lấy báo cáo gần đây (24h)
```http
GET /api/crowd-reports
```

**Response 200 (OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "reporter_name": "Nguyễn Văn A",
      "reporter_id": "user123",
      "flood_level": "Nặng",
      "reliability_score": 75,
      "validation_status": "cross_verified",
      "verified_by_sensor": true,
      "photo_url": "https://example.com/photo.jpg",
      "moderation_status": "approved",
      "lng": 106.721,
      "lat": 10.798,
      "created_at": "2024-12-20T10:00:00.000Z"
    }
  ]
}
```

---

### 2. Tạo báo cáo mới
```http
POST /api/report-flood
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Nguyễn Văn A",
  "reporter_id": "user123",
  "level": "Nặng",
  "lng": 106.721,
  "lat": 10.798,
  "photo_url": "https://example.com/photo.jpg"
}
```

**Response 200 (OK):**
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

**Response 400 (Bad Request):**
```json
{
  "success": false,
  "error": "Thiếu thông tin bắt buộc: name, level, lng, lat"
}
```

**Response 400 (Mức độ không hợp lệ):**
```json
{
  "success": false,
  "error": "Mức độ ngập không hợp lệ. Chọn: Nhẹ, Trung bình, hoặc Nặng"
}
```

---

## 🚨 Alert APIs

### 1. Lấy tất cả alerts
```http
GET /api/alerts?status=active&severity=critical&limit=100
Authorization: Bearer <token>
```

**Response 200 (OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "sensor_id": "S01",
      "alert_type": "danger",
      "severity": "critical",
      "message": "Cảnh báo ngập lụt tại Cầu Sài Gòn - Bình Thạnh: Mực nước 35.5cm",
      "water_level": 35.5,
      "velocity": 2.5,
      "status": "active",
      "location_name": "Cầu Sài Gòn - Bình Thạnh",
      "lng": 106.721,
      "lat": 10.798,
      "created_at": "2024-12-20T10:00:00.000Z"
    }
  ]
}
```

---

### 2. Lấy alerts đang active
```http
GET /api/alerts/active
Authorization: Bearer <token>
```

**Response 200 (OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "sensor_id": "S01",
      "alert_type": "danger",
      "severity": "critical",
      "message": "Cảnh báo ngập lụt...",
      "status": "active",
      "created_at": "2024-12-20T10:00:00.000Z"
    }
  ]
}
```

---

### 3. Xác nhận alert
```http
PUT /api/alerts/:alertId/acknowledge
Authorization: Bearer <token>
```

**Response 200 (OK):**
```json
{
  "success": true,
  "message": "Đã xác nhận alert",
  "data": {
    "id": 1,
    "status": "acknowledged",
    "acknowledged_by": 1,
    "acknowledged_at": "2024-12-20T10:05:00.000Z"
  }
}
```

---

### 4. Đánh dấu alert đã xử lý
```http
PUT /api/alerts/:alertId/resolve
Authorization: Bearer <token>
```

**Response 200 (OK):**
```json
{
  "success": true,
  "message": "Đã đánh dấu alert đã xử lý",
  "data": {
    "id": 1,
    "status": "resolved",
    "resolved_at": "2024-12-20T10:10:00.000Z"
  }
}
```

---

## ✅ Report Moderation APIs

### 1. Lấy báo cáo cần kiểm duyệt
```http
GET /api/reports/pending?limit=50
Authorization: Bearer <moderator-token>
```

**Response 200 (OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "reporter_name": "Nguyễn Văn A",
      "flood_level": "Nặng",
      "photo_url": "https://example.com/photo.jpg",
      "lng": 106.721,
      "lat": 10.798,
      "created_at": "2024-12-20T10:00:00.000Z"
    }
  ]
}
```

**Response 403 (Forbidden):**
```json
{
  "success": false,
  "error": "Chỉ admin hoặc moderator mới có quyền thực hiện thao tác này"
}
```

---

### 2. Kiểm duyệt báo cáo
```http
PUT /api/reports/:reportId/moderate
Authorization: Bearer <moderator-token>
Content-Type: application/json
```

**Request Body (Approve):**
```json
{
  "action": "approve"
}
```

**Request Body (Reject):**
```json
{
  "action": "reject",
  "rejection_reason": "Báo cáo không chính xác"
}
```

**Response 200 (OK - Approve):**
```json
{
  "success": true,
  "message": "Đã duyệt báo cáo",
  "data": {
    "id": 1,
    "moderation_status": "approved",
    "moderated_by": 2,
    "moderated_at": "2024-12-20T10:00:00.000Z"
  }
}
```

**Response 200 (OK - Reject):**
```json
{
  "success": true,
  "message": "Đã từ chối báo cáo",
  "data": {
    "id": 1,
    "moderation_status": "rejected",
    "rejection_reason": "Báo cáo không chính xác",
    "moderated_at": "2024-12-20T10:00:00.000Z"
  }
}
```

---

## ⭐ Report Evaluation APIs

### 1. Tạo đánh giá
```http
POST /api/report-evaluations/:reportId
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "rating": 5,
  "comment": "Báo cáo rất chính xác"
}
```

**Response 201 (Created):**
```json
{
  "success": true,
  "message": "Đánh giá thành công",
  "data": {
    "id": 1,
    "report_id": 1,
    "evaluator_id": 1,
    "rating": 5,
    "comment": "Báo cáo rất chính xác",
    "created_at": "2024-12-20T10:00:00.000Z"
  }
}
```

**Response 400 (Bad Request):**
```json
{
  "success": false,
  "error": "Rating phải từ 1 đến 5"
}
```

---

### 2. Lấy đánh giá của report
```http
GET /api/report-evaluations/:reportId
```

**Response 200 (OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "report_id": 1,
      "rating": 5,
      "comment": "Báo cáo rất chính xác",
      "evaluator_username": "user123",
      "evaluator_name": "Nguyễn Văn A",
      "created_at": "2024-12-20T10:00:00.000Z"
    }
  ]
}
```

---

### 3. Lấy điểm trung bình
```http
GET /api/report-evaluations/:reportId/average
```

**Response 200 (OK):**
```json
{
  "success": true,
  "data": {
    "avg_rating": 4.5,
    "total_evaluations": 10
  }
}
```

---

## 📢 Emergency Subscription APIs

### 1. Tạo subscription
```http
POST /api/emergency-subscriptions
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "lng": 106.721,
  "lat": 10.798,
  "radius": 1000,
  "notification_methods": ["email", "sms"]
}
```

**Response 201 (Created):**
```json
{
  "success": true,
  "message": "Đăng ký khẩn thành công",
  "data": {
    "id": 1,
    "user_id": 1,
    "lng": 106.721,
    "lat": 10.798,
    "radius": 1000,
    "notification_methods": ["email", "sms"],
    "is_active": true,
    "created_at": "2024-12-20T10:00:00.000Z"
  }
}
```

---

### 2. Lấy subscriptions của user
```http
GET /api/emergency-subscriptions/my-subscriptions
Authorization: Bearer <token>
```

**Response 200 (OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "lng": 106.721,
      "lat": 10.798,
      "radius": 1000,
      "notification_methods": ["email", "sms"],
      "is_active": true
    }
  ]
}
```

---

## 🗺️ Heatmap APIs

### 1. Lấy dữ liệu heatmap
```http
GET /api/heatmap?minLng=106.7&minLat=10.7&maxLng=106.8&maxLat=10.8&gridSize=500
```

**Response 200 (OK):**
```json
{
  "success": true,
  "data": [
    {
      "lng": 106.721,
      "lat": 10.798,
      "intensity": 15.5,
      "max_intensity": 20.0,
      "data_count": 5,
      "max_status": "warning"
    }
  ]
}
```

---

### 2. Lấy dữ liệu heatmap kết hợp
```http
GET /api/heatmap/combined?minLng=106.7&minLat=10.7&maxLng=106.8&maxLat=10.8
```

**Response 200 (OK):**
```json
{
  "success": true,
  "data": [
    {
      "lng": 106.721,
      "lat": 10.798,
      "water_level": 15.5,
      "status": "warning",
      "source": "sensor"
    },
    {
      "lng": 106.730,
      "lat": 10.800,
      "water_level": 30.0,
      "status": "normal",
      "source": "crowd"
    }
  ]
}
```

---

## 🔄 OTA Update APIs

### 1. Tạo OTA update (Admin)
```http
POST /api/ota
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "sensor_id": "S01",
  "firmware_version": "v2.0.0",
  "firmware_url": "https://example.com/firmware.bin",
  "checksum": "abc123def456",
  "scheduled_at": "2024-12-25T10:00:00Z"
}
```

**Response 201 (Created):**
```json
{
  "success": true,
  "message": "Tạo OTA update thành công",
  "data": {
    "id": 1,
    "sensor_id": "S01",
    "firmware_version": "v2.0.0",
    "firmware_url": "https://example.com/firmware.bin",
    "update_status": "pending",
    "created_at": "2024-12-20T10:00:00.000Z"
  }
}
```

---

### 2. Cập nhật trạng thái OTA (Sensor gọi về)
```http
PUT /api/ota/:otaId/status
Content-Type: application/json
```

**Request Body:**
```json
{
  "status": "completed"
}
```

**Response 200 (OK):**
```json
{
  "success": true,
  "message": "Cập nhật trạng thái OTA thành công",
  "data": {
    "id": 1,
    "update_status": "completed",
    "completed_at": "2024-12-20T10:00:00.000Z"
  }
}
```

---

## 🔋 Energy Monitoring APIs

### 1. Tạo energy log (Sensor gọi về)
```http
POST /api/energy
Content-Type: application/json
```

**Request Body:**
```json
{
  "sensor_id": "S01",
  "voltage": 3.7,
  "current": 50,
  "power": 185,
  "battery_level": 85,
  "power_source": "battery"
}
```

**Response 201 (Created):**
```json
{
  "success": true,
  "message": "Lưu energy log thành công",
  "data": {
    "id": 1,
    "sensor_id": "S01",
    "voltage": 3.7,
    "current": 50,
    "power": 185,
    "battery_level": 85,
    "power_source": "battery",
    "created_at": "2024-12-20T10:00:00.000Z"
  }
}
```

---

### 2. Lấy sensors có pin thấp (Admin)
```http
GET /api/energy/low-battery?threshold=20
Authorization: Bearer <admin-token>
```

**Response 200 (OK):**
```json
{
  "success": true,
  "data": [
    {
      "sensor_id": "S01",
      "location_name": "Cầu Sài Gòn - Bình Thạnh",
      "battery_level": 15,
      "power_source": "battery",
      "voltage": 3.2,
      "current": 30,
      "power": 96
    }
  ]
}
```

---

## 📊 Tổng Kết Response Codes

| Endpoint Type | Success | Error Cases |
|---------------|---------|-------------|
| **GET** | 200 | 400, 401, 403, 404, 500 |
| **POST** | 201 | 400, 401, 403, 500 |
| **PUT** | 200 | 400, 401, 403, 404, 500 |
| **DELETE** | 200 | 401, 403, 404, 500 |

---

## 🔑 Authentication Headers

Tất cả endpoints yêu cầu authentication sẽ cần header:
```
Authorization: Bearer <your-jwt-token>
```

Nếu thiếu hoặc token không hợp lệ, sẽ nhận được:
```json
{
  "success": false,
  "error": "Token không được cung cấp"
}
```
hoặc
```json
{
  "success": false,
  "error": "Token không hợp lệ hoặc đã hết hạn"
}
```

