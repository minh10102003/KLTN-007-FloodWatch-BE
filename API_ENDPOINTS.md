# API Endpoints Documentation

Base URL: `http://localhost:3000`

## 1. GET /api/flood-history
**Mô tả:** Lấy dữ liệu ngập lụt từ bảng flood_logs (API cũ - không có thông tin vị trí)

**Response Example:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "sensor_id": "S01",
      "water_level": 25.5,
      "created_at": "2026-01-27T10:30:00.000Z"
    },
    {
      "id": 2,
      "sensor_id": "S01",
      "water_level": 30.2,
      "created_at": "2026-01-27T10:35:00.000Z"
    }
  ]
}
```

**Lưu ý:** API này không có thông tin vị trí (lat/lng), chỉ có sensor_id và water_level.

---

## 2. GET /api/v1/flood-data ⭐ (KHUYẾN NGHỊ SỬ DỤNG)
**Mô tả:** Lấy dữ liệu ngập lụt kèm thông tin sensor (join với bảng sensors) - CÓ VỊ TRÍ

**Response Example:**
```json
{
  "success": true,
  "data": [
    {
      "sensor_id": "S01",
      "water_level": 25.5,
      "created_at": "2026-01-27T10:30:00.000Z",
      "location_name": "Cầu Sài Gòn - Bình Thạnh",
      "lng": 106.721,
      "lat": 10.798
    },
    {
      "sensor_id": "S01",
      "water_level": 30.2,
      "created_at": "2026-01-27T10:35:00.000Z",
      "location_name": "Cầu Sài Gòn - Bình Thạnh",
      "lng": 106.721,
      "lat": 10.798
    }
  ]
}
```

**Các trường:**
- `sensor_id`: ID của cảm biến
- `water_level`: Mức nước (cm)
- `created_at`: Thời gian ghi nhận
- `location_name`: Tên vị trí trạm
- `lng`: Kinh độ (Longitude)
- `lat`: Vĩ độ (Latitude)

---

## 3. GET /api/crowd-reports
**Mô tả:** Lấy các báo cáo từ người dân trong vòng 24 giờ qua

**Response Example:**
```json
{
  "success": true,
  "data": [
    {
      "reporter_name": "Nguyễn Văn A",
      "flood_level": "Nặng",
      "lng": 106.701,
      "lat": 10.776,
      "created_at": "2026-01-27T09:15:00.000Z"
    },
    {
      "reporter_name": "Trần Thị B",
      "flood_level": "Trung bình",
      "lng": 106.715,
      "lat": 10.785,
      "created_at": "2026-01-27T08:30:00.000Z"
    }
  ]
}
```

**Các trường:**
- `reporter_name`: Tên người báo cáo
- `flood_level`: Mức độ ngập ("Nhẹ", "Trung bình", "Nặng")
- `lng`: Kinh độ
- `lat`: Vĩ độ
- `created_at`: Thời gian báo cáo

---

## 4. POST /api/report-flood
**Mô tả:** Tạo báo cáo ngập lụt mới từ người dùng

**Request Body:**
```json
{
  "name": "Nguyễn Văn A",
  "level": "Nặng",
  "lng": 106.701,
  "lat": 10.776
}
```

**Response Success:**
```json
{
  "success": true,
  "message": "Cảm ơn bạn đã báo cáo!"
}
```

**Response Error:**
```json
{
  "success": false,
  "error": "Error message here"
}
```

---

## Tóm tắt Endpoints

| Method | Endpoint | Mô tả | Có vị trí? |
|--------|----------|-------|------------|
| GET | `/api/flood-history` | Dữ liệu từ sensor (cũ) | ❌ |
| GET | `/api/v1/flood-data` | Dữ liệu từ sensor (mới) | ✅ |
| GET | `/api/crowd-reports` | Báo cáo từ người dân | ✅ |
| POST | `/api/report-flood` | Tạo báo cáo mới | - |

## Khuyến nghị cho Frontend

**Sử dụng `/api/v1/flood-data` thay vì `/api/flood-history`** vì:
- ✅ Có đầy đủ thông tin vị trí (lat, lng)
- ✅ Có tên vị trí (location_name)
- ✅ Join với bảng sensors để lấy thông tin chính xác


