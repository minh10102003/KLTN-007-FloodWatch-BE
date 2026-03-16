# API cho Admin FE – Kết nối BE

Tài liệu trích xuất toàn bộ API backend dùng cho các tính năng Admin vừa làm (Sensors, Users, Settings). FE gọi từ **hcm-flood-admin** với **Bearer token** (trừ khi ghi chú công khai).

**Base URL:** `process.env.VITE_API_BASE_URL` hoặc `http://localhost:3000`  
**Header:** `Authorization: Bearer <token>` (đăng nhập lấy token từ `/api/auth/login`).

---

## 1. Sensors (Trang Quản lý Sensors)

### 1.1. Lấy danh sách sensors

```
GET /api/sensors
```

**Query (tùy chọn):** `is_active`, `status`, `hardware_type`

**Response 200:**
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
      "last_data_time": "2025-03-12T10:00:00.000Z",
      "lng": 106.721,
      "lat": 10.798,
      "warning_threshold": 10,
      "danger_threshold": 30,
      "created_at": "2024-12-20T00:00:00.000Z"
    }
  ]
}
```

**Phân quyền:** Có thể gọi không cần auth (công khai). Admin FE vẫn gửi token.

---

### 1.2. Lấy một sensor theo ID

```
GET /api/sensors/:sensorId
```

**Response 200:** Cùng cấu trúc một object trong `data` như trên.  
**404:** Sensor không tồn tại.

---

### 1.3. Cập nhật thông tin sensor (tọa độ, độ cao, …)

```
PUT /api/sensors/:sensorId
```

**Header:** `Authorization: Bearer <token>` (Admin).

**Body (JSON, tất cả tùy chọn – chỉ gửi field cần sửa):**
```json
{
  "location_name": "Cầu Sài Gòn - Cập nhật",
  "lng": 106.721,
  "lat": 10.798,
  "installation_height": 150,
  "hardware_type": "ESP32",
  "model": "HC-SR04",
  "installation_date": "2024-12-20",
  "is_active": true
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Cập nhật sensor thành công",
  "data": { ... }
}
```

**403:** Không phải Admin.

---

### 1.4. Cập nhật ngưỡng báo động

```
PUT /api/sensors/:sensorId/thresholds
```

**Header:** `Authorization: Bearer <token>` (Admin).

**Body (JSON):**
```json
{
  "warning_threshold": 10,
  "danger_threshold": 30,
  "updated_by": "admin"
}
```

**Ràng buộc:** `warning_threshold` < `danger_threshold`.

**Response 200:**
```json
{
  "success": true,
  "message": "Cập nhật ngưỡng báo động thành công",
  "data": { ... }
}
```

---

### 1.5. Tạo sensor mới (nếu FE có nút Thêm trạm)

```
POST /api/sensors
```

**Header:** `Authorization: Bearer <token>` (Admin).

**Body (JSON):**
```json
{
  "sensor_id": "S04",
  "location_name": "Tên vị trí",
  "lng": 106.72,
  "lat": 10.80,
  "installation_height": 150,
  "hardware_type": "ESP32",
  "model": "HC-SR04",
  "installation_date": "2025-01-01",
  "warning_threshold": 10,
  "danger_threshold": 30
}
```

**Bắt buộc:** `sensor_id`, `location_name`, `lng`, `lat`, `installation_height`.

**Response 201:** `success`, `message`, `data` (sensor vừa tạo).  
**400:** Thiếu field hoặc `sensor_id` đã tồn tại.

---

### 1.6. Xóa sensor

```
DELETE /api/sensors/:sensorId
```

**Header:** `Authorization: Bearer <token>` (Admin).

**Response 200:** `success`, `message`.

---

**Chưa có trên BE (FE đang mock):**

- **Calibrate Sensor:** chưa có endpoint; FE `console.log` hoặc gọi API sau khi BE bổ sung.
- **Maintenance Mode (bật/tắt):** chưa có field/API; FE lưu state local hoặc chờ BE thêm cột/endpoint.

---

## 2. Users (Trang Quản lý User)

### 2.1. Lấy danh sách users

```
GET /api/auth/users?limit=200&offset=0
```

**Header:** `Authorization: Bearer <token>` (Admin).

**Query:** `limit` (mặc định 100, tối đa 500), `offset` (mặc định 0).

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "username": "admin",
      "email": "admin@hcm-flood.gov.vn",
      "full_name": "Admin",
      "phone": null,
      "role": "admin",
      "is_active": true,
      "reporter_reliability": 50,
      "last_login": "2025-03-12T10:00:00.000Z",
      "created_at": "2024-12-20T00:00:00.000Z"
    }
  ]
}
```

---

### 2.2. Đổi role (Change Role)

```
PUT /api/auth/users/:userId/role
```

**Header:** `Authorization: Bearer <token>` (Admin).

**Body (JSON):**
```json
{
  "role": "moderator"
}
```

**Role hợp lệ:** `user`, `moderator`, `admin`.

**Response 200:** `success`, `message`, `data`.  
**400:** Role không hợp lệ hoặc không thể tự hạ quyền (admin duy nhất).  
**404:** Không tìm thấy user.

---

### 2.3. Khóa / Mở khóa user (Ban User / Unban)

```
PUT /api/auth/users/:userId/active
```

**Header:** `Authorization: Bearer <token>` (Admin).

**Body (JSON):**
```json
{
  "is_active": false
}
```

`false` = khóa (Ban), `true` = mở khóa (Unban).

**Response 200:** `success`, `message`, `data`.  
**400:** Thiếu hoặc sai `is_active` (phải boolean).  
**404:** Không tìm thấy user.

**Lưu ý:** BE hiện không nhận lý do ban (rejection_reason). FE có thể gửi Dialog nhập lý do để lưu local hoặc gửi lên sau khi BE bổ sung field.

---

### 2.4. Tạo user mới

```
POST /api/auth/users
```

**Header:** `Authorization: Bearer <token>` (Admin).

**Body (JSON):**
```json
{
  "username": "mod01",
  "email": "mod01@hcmflood.vn",
  "password": "SecurePass123",
  "role": "moderator",
  "full_name": "Moderator One",
  "phone": "0901234567"
}
```

**Bắt buộc:** `username`, `email`, `password`, `role`.  
**Tùy chọn:** `full_name`, `phone`.

**Response 201:** `success`, `message`, `data` (user vừa tạo).  
**400:** Thiếu field, role không hợp lệ, hoặc username/email đã tồn tại.

---

### 2.5. Tính lại điểm tin cậy reporter

```
POST /api/auth/users/:userId/recompute-reliability
```

**Header:** `Authorization: Bearer <token>` (Admin).

**Body:** Không cần.

**Response 200:** `success`, `message`, `data` (ví dụ `reporter_reliability`).  
**403/404:** Không có quyền hoặc không tìm thấy user.

---

**Chưa có trên BE (FE đang mock):**

- **Force Password Reset:** chưa có endpoint; FE mock / chờ BE thêm API (ví dụ `POST /api/auth/users/:userId/force-reset-password`).

---

## 3. Settings (Trang Cài đặt hệ thống)

**Hiện BE chưa có API cho Trust Score Engine và System Config (Maintenance Mode).** FE đang dùng state local + Toast khi Save.

Khi BE triển khai, có thể thiết kế ví dụ:

| Tính năng           | Gợi ý endpoint              | Mô tả ngắn |
|---------------------|-----------------------------|------------|
| Trust Score Engine  | `GET/PUT /api/settings/trust-score` | Trọng số điểm cộng/trừ (verified, rejected, has_photo). |
| System Config       | `GET/PUT /api/settings/system`      | Cấu hình toàn cục (maintenance_mode: boolean). |

FE sẽ thay mock bằng gọi các endpoint trên khi có.

---

## 4. Tổng hợp endpoint theo trang FE

| Trang FE     | Chức năng              | Method | Endpoint                              | Ghi chú        |
|--------------|------------------------|--------|----------------------------------------|----------------|
| Sensors      | Danh sách sensors      | GET    | `/api/sensors`                         | Có thể không auth |
| Sensors      | Chi tiết 1 sensor      | GET    | `/api/sensors/:sensorId`               | —              |
| Sensors      | Sửa cấu hình          | PUT    | `/api/sensors/:sensorId`               | Admin          |
| Sensors      | Sửa ngưỡng            | PUT    | `/api/sensors/:sensorId/thresholds`    | Admin          |
| Sensors      | Calibrate / Maintenance| —      | Chưa có                                | Mock           |
| Users        | Danh sách users        | GET    | `/api/auth/users`                      | Admin          |
| Users        | Đổi role               | PUT    | `/api/auth/users/:userId/role`         | Admin          |
| Users        | Khóa/Mở user           | PUT    | `/api/auth/users/:userId/active`       | Admin          |
| Users        | Tạo user               | POST   | `/api/auth/users`                      | Admin          |
| Users        | Tính lại độ tin cậy    | POST   | `/api/auth/users/:userId/recompute-reliability` | Admin |
| Users        | Force Password Reset   | —      | Chưa có                                | Mock           |
| Settings     | Trust Score / System   | —      | Chưa có                                | Mock           |

---

## 5. Auth chung

- **Đăng nhập:** `POST /api/auth/login` với `{ "username", "password" }` → trả `data.token`, `data.user`. FE lưu token (vd. localStorage) và gửi header `Authorization: Bearer <token>` cho mọi request Admin.
- **Đăng xuất:** `POST /api/auth/logout` (có token) + xóa token/user ở FE.

Tài liệu này đủ để FE kết nối BE cho các function Admin đã làm; phần chưa có endpoint ghi rõ để FE giữ mock hoặc chuẩn bị nối khi BE mở rộng.
