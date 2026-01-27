# 🔧 Sửa lỗi đồng bộ dữ liệu giữa ESP32 và Backend

## 🐛 Vấn đề

Mực nước hiển thị trên mạch giả lập (Wokwi) khác với dữ liệu trong Backend.

## 🔍 Nguyên nhân

### 1. ESP32 gửi sai dữ liệu
**Code cũ (SAI):**
```cpp
int water_level = INSTALL_HEIGHT - fake_distance;  // Tính mực nước
String payload = "{\"sensor_id\": \"S01\", \"value\":" + String(water_level) + "}";  // Gửi water_level
```

**Vấn đề:** ESP32 đã tính `water_level` và gửi lên, nhưng Backend lại coi `value` là `raw_distance` và tính lại → **Tính 2 lần → SAI!**

### 2. Database không khớp với ESP32
- **ESP32:** `INSTALL_HEIGHT = 150`
- **Database:** `installation_height = 100.0` ❌

## ✅ Giải pháp

### Bước 1: Sửa code ESP32

**Thay đổi:** Gửi `raw_distance` (khoảng cách đo được) thay vì `water_level`

**Code mới (ĐÚNG):**
```cpp
// Tính water_level chỉ để hiển thị LCD
int water_level = INSTALL_HEIGHT - fake_distance;

// Gửi raw_distance lên Backend (Backend sẽ tự tính water_level)
String payload = "{\"sensor_id\": \"S01\", \"value\":" + String(fake_distance) + "}";
```

**File đã sửa:** `ESP32_CODE_FIXED.ino`

### Bước 2: Cập nhật Database

**Cập nhật `installation_height` cho sensor S01 từ 100.0 lên 150.0**

**Cách 1: Chạy script SQL**
```sql
UPDATE sensors 
SET installation_height = 150.0 
WHERE sensor_id = 'S01';
```

**File:** `database/update_s01_installation_height.sql`

**Cách 2: Nếu tạo database mới**
- File `database/schema.sql` đã được cập nhật với `installation_height = 150.0`

### Bước 3: Kiểm tra lại

1. **Cập nhật code ESP32** với code mới
2. **Chạy script SQL** để cập nhật database (nếu database đã tồn tại)
3. **Restart Backend server**
4. **Kiểm tra logs** trong Backend console

**Logs Backend sẽ hiển thị:**
```
💾 [Data] S01: 50.00cm (warning), velocity: 1.67cm/min
```

## 📊 Luồng dữ liệu đúng

```
ESP32:
  fake_distance = 100cm (khoảng cách từ cảm biến tới mặt nước)
  water_level = 150 - 100 = 50cm (hiển thị LCD)
  → Gửi: {"sensor_id": "S01", "value": 100}  ← raw_distance

Backend nhận:
  value = 100 (raw_distance)
  installation_height = 150 (từ database)
  → Tính: water_level = 150 - 100 = 50cm ✅

Kết quả: Khớp với LCD! ✅
```

## 🎯 Quy tắc nghiệp vụ

1. **ESP32 chỉ gửi `raw_distance`** (khoảng cách đo được từ cảm biến)
2. **Backend tính `water_level`** = `installation_height - raw_distance`
3. **`installation_height` trong database phải khớp** với `INSTALL_HEIGHT` trong code ESP32

## 📝 Checklist

- [ ] Cập nhật code ESP32 (gửi `fake_distance` thay vì `water_level`)
- [ ] Cập nhật database: `installation_height = 150.0` cho sensor S01
- [ ] Restart Backend server
- [ ] Test và kiểm tra logs
- [ ] So sánh giá trị trên LCD và trong Backend → Phải khớp!

## 🔄 Nếu vẫn sai

1. **Kiểm tra logs Backend:**
   ```
   💾 [Data] S01: XX.XXcm (status)
   ```

2. **Kiểm tra database:**
   ```sql
   SELECT sensor_id, installation_height FROM sensors WHERE sensor_id = 'S01';
   ```

3. **Kiểm tra ESP32 Serial Monitor:**
   ```
   Simulating Flood - Sending raw_distance: XXXcm (water_level on LCD: XXcm)
   ```

4. **So sánh:**
   - LCD hiển thị: `water_level = 50cm`
   - Backend tính: `water_level = installation_height - raw_distance`
   - Phải bằng nhau!

---

**Cập nhật:** 2026-01-27
