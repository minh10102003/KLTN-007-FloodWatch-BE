# 🚀 Hướng Dẫn Các Tính Năng Mới

Tài liệu này mô tả các tính năng mới đã được thêm vào hệ thống dựa trên Use Case Diagram.

## 📋 Mục Lục

1. [Cài Đặt Dependencies](#cài-đặt-dependencies)
2. [Database Migration](#database-migration)
3. [User Authentication & Authorization](#user-authentication--authorization)
4. [Alert System](#alert-system)
5. [Report Moderation](#report-moderation)
6. [Report Evaluation](#report-evaluation)
7. [Emergency Subscription](#emergency-subscription)
8. [Heatmap Data](#heatmap-data)
9. [OTA Update Management](#ota-update-management)
10. [Energy Monitoring](#energy-monitoring)
11. [Kalman Filter & Checksum Validation](#kalman-filter--checksum-validation)

---

## 🔧 Cài Đặt Dependencies

```bash
npm install bcrypt jsonwebtoken --save
```

Thêm vào `.env`:
```
JWT_SECRET=your-secret-key-here
```

---

## 🗄️ Database Migration

Chạy file migration để tạo các bảng mới:

```bash
psql -U your_user -d your_database -f database/add_new_features.sql
```

Hoặc chạy trực tiếp trong PostgreSQL client.

---

## 👤 User Authentication & Authorization

### Đăng ký
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "user123",
  "email": "user@example.com",
  "password": "password123",
  "full_name": "Nguyễn Văn A",
  "phone": "0123456789"
}
```

### Đăng nhập
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "user123",
  "password": "password123"
}
```

Response sẽ trả về JWT token:
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Sử dụng Token
Thêm header vào các request cần authentication:
```
Authorization: Bearer <token>
```

### Các Endpoints
- `GET /api/auth/profile` - Lấy thông tin user hiện tại
- `PUT /api/auth/profile` - Cập nhật profile
- `PUT /api/auth/change-password` - Đổi mật khẩu

---

## 🚨 Alert System

Hệ thống tự động tạo alert khi:
- Mực nước vượt ngưỡng warning/danger
- Sensor offline > 5 phút
- Vận tốc nước dâng cao

### Endpoints
- `GET /api/alerts` - Lấy tất cả alerts (có filter)
- `GET /api/alerts/active` - Lấy alerts đang active
- `GET /api/alerts/stats` - Thống kê alerts
- `GET /api/alerts/:alertId` - Lấy alert theo ID
- `PUT /api/alerts/:alertId/acknowledge` - Xác nhận đã xem
- `PUT /api/alerts/:alertId/resolve` - Đánh dấu đã xử lý

### Query Parameters
- `status`: active, acknowledged, resolved
- `severity`: low, medium, high, critical
- `alert_type`: warning, danger, offline, velocity_spike
- `sensor_id`: ID của sensor

---

## ✅ Report Moderation

### Endpoints (Cần quyền Moderator/Admin)
- `GET /api/reports/pending` - Lấy báo cáo cần kiểm duyệt
- `PUT /api/reports/:reportId/moderate` - Kiểm duyệt báo cáo
- `GET /api/reports/reliability-ranking` - Xếp hạng tin cậy

### Kiểm duyệt báo cáo
```http
PUT /api/reports/:reportId/moderate
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "approve",  // hoặc "reject"
  "rejection_reason": "Lý do từ chối (nếu reject)"
}
```

---

## ⭐ Report Evaluation

Người dùng có thể đánh giá báo cáo từ 1-5 sao.

### Endpoints
- `POST /api/report-evaluations/:reportId` - Tạo đánh giá
- `GET /api/report-evaluations/:reportId` - Lấy đánh giá của report
- `GET /api/report-evaluations/:reportId/average` - Lấy điểm trung bình

### Tạo đánh giá
```http
POST /api/report-evaluations/:reportId
Authorization: Bearer <token>
Content-Type: application/json

{
  "rating": 5,
  "comment": "Báo cáo chính xác"
}
```

---

## 📢 Emergency Subscription

Người dùng đăng ký nhận cảnh báo khẩn trong bán kính nhất định.

### Endpoints
- `POST /api/emergency-subscriptions` - Tạo subscription
- `GET /api/emergency-subscriptions/my-subscriptions` - Lấy subscriptions của user
- `PUT /api/emergency-subscriptions/:subscriptionId` - Cập nhật subscription
- `DELETE /api/emergency-subscriptions/:subscriptionId` - Xóa subscription

### Tạo subscription
```http
POST /api/emergency-subscriptions
Authorization: Bearer <token>
Content-Type: application/json

{
  "lng": 106.721,
  "lat": 10.798,
  "radius": 1000,  // Bán kính (mét)
  "notification_methods": ["email", "sms"]
}
```

---

## 🗺️ Heatmap Data

Lấy dữ liệu heatmap để hiển thị trên bản đồ.

### Endpoints
- `GET /api/heatmap` - Lấy dữ liệu heatmap từ sensors
- `GET /api/heatmap/combined` - Lấy dữ liệu kết hợp (sensors + crowd reports)

### Query Parameters
- `minLng`, `minLat`, `maxLng`, `maxLat`: Giới hạn khu vực
- `gridSize`: Kích thước lưới (mét, mặc định 500)

---

## 🔄 OTA Update Management

Quản lý cập nhật firmware OTA cho sensors.

### Endpoints (Admin)
- `POST /api/ota` - Tạo OTA update
- `GET /api/ota/pending` - Lấy OTA updates đang pending
- `GET /api/ota/sensor/:sensorId` - Lấy OTA updates theo sensor
- `GET /api/ota/:otaId` - Lấy OTA update theo ID
- `PUT /api/ota/:otaId/status` - Cập nhật trạng thái (sensor gọi về)

### Tạo OTA Update
```http
POST /api/ota
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "sensor_id": "S01",
  "firmware_version": "v2.0.0",
  "firmware_url": "https://example.com/firmware.bin",
  "checksum": "abc123...",
  "scheduled_at": "2024-12-25T10:00:00Z"  // Optional
}
```

---

## 🔋 Energy Monitoring

Theo dõi năng lượng của sensors (cho mạch thật).

### Endpoints
- `POST /api/energy` - Tạo energy log (sensor gọi về)
- `GET /api/energy/sensor/:sensorId` - Lấy energy logs
- `GET /api/energy/sensor/:sensorId/latest` - Lấy log mới nhất
- `GET /api/energy/sensor/:sensorId/stats` - Thống kê năng lượng
- `GET /api/energy/low-battery` - Lấy sensors có pin thấp (Admin)

### Sensor gửi energy data
```http
POST /api/energy
Content-Type: application/json

{
  "sensor_id": "S01",
  "voltage": 3.7,
  "current": 50,
  "power": 185,
  "battery_level": 85,
  "power_source": "battery"  // hoặc "solar", "grid"
}
```

---

## 🔍 Kalman Filter & Checksum Validation

### Kalman Filter
Đã được tích hợp vào MQTT service để lọc nhiễu dữ liệu. Tự động áp dụng cho mỗi sensor.

### Checksum Validation
Nếu payload MQTT có field `checksum`, hệ thống sẽ validate:
```json
{
  "sensor_id": "S01",
  "value": 120.5,
  "timestamp": "2024-12-20T10:00:00Z",
  "checksum": "abc123..."
}
```

---

## 📝 Ghi Chú Quan Trọng

1. **Database Migration**: Phải chạy `add_new_features.sql` trước khi sử dụng các tính năng mới
2. **JWT Secret**: Đặt `JWT_SECRET` trong `.env` để bảo mật
3. **Photo Upload**: Hiện tại hỗ trợ `photo_url` trong report, cần tích hợp với service upload ảnh (S3, Cloudinary, etc.)
4. **Notification Service**: Emergency subscription cần tích hợp với email/SMS service
5. **OTA Firmware URL**: Cần host firmware files trên server hoặc cloud storage

---

## 🔐 Phân Quyền

- **User**: Đánh giá báo cáo, đăng ký khẩn, xem dữ liệu
- **Moderator**: Tất cả quyền User + Kiểm duyệt báo cáo
- **Admin**: Tất cả quyền + Quản lý users, OTA updates, sensors

---

## 🚀 Scaling cho Mạch Thật

Các tính năng đã được thiết kế để scale:
- **Energy Monitoring**: Sẵn sàng cho mạch thật gửi dữ liệu năng lượng
- **Checksum Validation**: Bảo vệ tính toàn vẹn dữ liệu
- **Kalman Filter**: Lọc nhiễu tốt hơn cho dữ liệu thực tế
- **OTA Updates**: Quản lý firmware updates từ xa
- **Alert System**: Tự động cảnh báo khi có vấn đề

---

## 📞 Support

Nếu có vấn đề, kiểm tra:
1. Database migration đã chạy chưa
2. Dependencies đã cài đặt chưa
3. Environment variables đã set chưa
4. JWT token có hợp lệ không

