# 📱 Hướng dẫn tích hợp Crowdsourcing cho Frontend

## 📋 Tổng quan

Chức năng **Crowdsourcing** cho phép người dùng báo cáo tình trạng ngập lụt tại vị trí của họ. Hệ thống sẽ tự động:
- ✅ Xác minh chéo với dữ liệu từ cảm biến IoT trong bán kính 500m
- ✅ Tính điểm tin cậy cho người báo cáo
- ✅ Phân loại trạng thái xác minh (pending/verified/cross_verified)

---

## 🔌 API Endpoints

### 1. POST /api/report-flood
**Mô tả:** Tạo báo cáo ngập lụt mới từ người dùng

**Request:**
```http
POST /api/report-flood
Content-Type: application/json

{
  "name": "Nguyễn Văn A",           // Required: Tên người báo cáo
  "reporter_id": "user_123",         // Optional: ID người dùng (để tính điểm tin cậy)
  "level": "Nặng",                   // Required: "Nhẹ" | "Trung bình" | "Nặng"
  "lng": 106.701,                    // Required: Kinh độ
  "lat": 10.776                      // Required: Vĩ độ
}
```

**Response Success (Đã xác minh):**
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

**Response Success (Chờ xem xét):**
```json
{
  "success": true,
  "message": "Báo cáo của bạn đang được xem xét. Cảm ơn!",
  "data": {
    "validation_status": "pending",
    "verified_by_sensor": false
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

**Status Codes:**
- `200`: Thành công
- `400`: Dữ liệu không hợp lệ
- `500`: Lỗi server

---

### 2. GET /api/crowd-reports
**Mô tả:** Lấy các báo cáo từ người dân trong vòng 24 giờ qua

**Request:**
```http
GET /api/crowd-reports
```

**Response:**
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
    },
    {
      "id": 2,
      "reporter_name": "Trần Thị B",
      "reporter_id": null,
      "flood_level": "Trung bình",
      "reliability_score": 50.0,
      "validation_status": "pending",
      "verified_by_sensor": false,
      "lng": 106.715,
      "lat": 10.785,
      "created_at": "2026-01-27T08:30:00.000Z"
    }
  ]
}
```

---

### 3. GET /api/crowd-reports/all
**Mô tả:** Lấy tất cả báo cáo (không giới hạn thời gian)

**Request:**
```http
GET /api/crowd-reports/all?limit=100
```

**Query Parameters:**
- `limit` (optional): Số lượng bản ghi (mặc định: 100)

**Response:** Tương tự như `/api/crowd-reports`

---

## 📊 Cấu trúc dữ liệu

### Flood Level (Mức độ ngập)
| Giá trị | Mô tả | Chiều cao ước tính |
|---------|-------|-------------------|
| `"Nhẹ"` | Đến mắt cá | ~10cm |
| `"Trung bình"` | Đến đầu gối | ~30cm |
| `"Nặng"` | Ngập nửa xe | ~50cm |

### Validation Status (Trạng thái xác minh)
| Giá trị | Mô tả | Hiển thị UI |
|---------|-------|-------------|
| `"pending"` | Chờ kiểm tra | ⏳ Icon đồng hồ, màu vàng |
| `"verified"` | Đã xác minh (bởi admin) | ✅ Icon check, màu xanh |
| `"cross_verified"` | Đã xác minh chéo với sensor | ✅ Icon check x2, màu xanh đậm |
| `"rejected"` | Bị từ chối | ❌ Icon X, màu đỏ |

### Reliability Score (Điểm tin cậy)
- **Phạm vi:** 0 - 100
- **Mặc định:** 50 (người mới)
- **Cập nhật tự động:**
  - ✅ +5 điểm khi báo cáo được xác minh chéo
  - ❌ -10 điểm khi báo cáo bị từ chối (tính năng tương lai)

**Gợi ý hiển thị:**
- 0-30: 🔴 Độ tin cậy thấp
- 31-60: 🟡 Độ tin cậy trung bình
- 61-80: 🟢 Độ tin cậy cao
- 81-100: ⭐ Độ tin cậy rất cao

---

## 🔍 Logic xác minh chéo (Cross-validation)

### Quy trình tự động:

1. **Tìm sensor gần nhất** trong bán kính 500m từ vị trí báo cáo
2. **So sánh dữ liệu:**
   - Nếu sensor báo `warning` hoặc `danger` VÀ mực nước sensor >= 70% mức độ ngập báo cáo
     → ✅ **`cross_verified`** (Xác minh chéo)
   - Nếu sensor báo `normal` và mực nước < 10cm
     → ⏳ **`pending`** (Chờ kiểm tra)
   - Không có sensor trong bán kính
     → ⏳ **`pending`** (Chờ kiểm tra)

### Ví dụ:

**Trường hợp 1: Xác minh thành công**
```
Người dân báo: "Nặng" (~50cm)
Sensor gần nhất (300m): water_level = 45cm, status = "danger"
→ Kết quả: cross_verified ✅
```

**Trường hợp 2: Chờ kiểm tra**
```
Người dân báo: "Nặng" (~50cm)
Sensor gần nhất (400m): water_level = 5cm, status = "normal"
→ Kết quả: pending ⏳
```

---

## 🎨 UI/UX Gợi ý

### 1. Form báo cáo ngập

**Các trường cần có:**
```jsx
<Form>
  <Input 
    label="Tên của bạn" 
    name="name" 
    required 
    placeholder="Nhập tên hoặc để ẩn danh"
  />
  
  <Select 
    label="Mức độ ngập" 
    name="level" 
    required
    options={[
      { value: "Nhẹ", label: "Nhẹ - Đến mắt cá (~10cm)" },
      { value: "Trung bình", label: "Trung bình - Đến đầu gối (~30cm)" },
      { value: "Nặng", label: "Nặng - Ngập nửa xe (~50cm)" }
    ]}
  />
  
  <MapPicker 
    label="Vị trí ngập" 
    onLocationSelect={(lng, lat) => {...}}
    required
  />
  
  <Button type="submit">Gửi báo cáo</Button>
</Form>
```

**Xử lý response:**
```jsx
// Sau khi submit thành công
if (response.data.verified_by_sensor) {
  showSuccessToast("✅ Báo cáo đã được xác minh bởi hệ thống!");
} else {
  showInfoToast("⏳ Báo cáo đang được xem xét. Cảm ơn bạn!");
}
```

---

### 2. Hiển thị báo cáo trên bản đồ

**Marker cho báo cáo:**
```jsx
// Màu sắc theo validation_status
const getMarkerColor = (status, verified) => {
  if (verified || status === 'cross_verified') return '#28a745'; // Xanh
  if (status === 'pending') return '#ffc107'; // Vàng
  if (status === 'rejected') return '#dc3545'; // Đỏ
  return '#6c757d'; // Xám
};

// Icon theo validation_status
const getMarkerIcon = (status, verified) => {
  if (verified || status === 'cross_verified') return 'verified-badge';
  if (status === 'pending') return 'clock';
  if (status === 'rejected') return 'x-circle';
  return 'info';
};
```

**Popup/InfoWindow:**
```jsx
<Popup>
  <div className="report-popup">
    <h3>{report.reporter_name}</h3>
    <Badge 
      color={getStatusColor(report.validation_status)}
      text={getStatusText(report.validation_status)}
    />
    <p>Mức độ: <strong>{report.flood_level}</strong></p>
    {report.verified_by_sensor && (
      <p className="verified-badge">
        ✅ Đã xác minh bởi cảm biến
      </p>
    )}
    {report.reliability_score > 60 && (
      <p className="reliability">
        ⭐ Độ tin cậy: {report.reliability_score}/100
      </p>
    )}
    <p className="time">
      {formatTime(report.created_at)}
    </p>
  </div>
</Popup>
```

---

### 3. Danh sách báo cáo

**Component gợi ý:**
```jsx
<ReportList>
  {reports.map(report => (
    <ReportCard key={report.id}>
      <ReportHeader>
        <Avatar name={report.reporter_name} />
        <div>
          <h4>{report.reporter_name}</h4>
          <span className="time">{formatTime(report.created_at)}</span>
        </div>
        <StatusBadge 
          status={report.validation_status}
          verified={report.verified_by_sensor}
        />
      </ReportHeader>
      
      <ReportBody>
        <FloodLevelBadge level={report.flood_level} />
        <LocationText lng={report.lng} lat={report.lat} />
      </ReportBody>
      
      {report.reliability_score > 60 && (
        <ReliabilityScore score={report.reliability_score} />
      )}
    </ReportCard>
  ))}
</ReportList>
```

---

## 💻 Ví dụ code tích hợp

### React/Next.js Example

```jsx
import { useState } from 'react';
import { MapContainer, Marker, Popup, useMapEvents } from 'react-leaflet';

const ReportFloodForm = ({ userId }) => {
  const [formData, setFormData] = useState({
    name: '',
    reporter_id: userId || null,
    level: '',
    lng: null,
    lat: null
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.level || !formData.lng || !formData.lat) {
      alert('Vui lòng điền đầy đủ thông tin');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/report-flood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      
      if (data.success) {
        setResult(data);
        // Reset form
        setFormData({ ...formData, level: '', lng: null, lat: null });
        // Show success message
        alert(data.message);
      } else {
        alert('Lỗi: ' + data.error);
      }
    } catch (error) {
      alert('Lỗi kết nối: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Tên của bạn"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        required
      />
      
      <select
        value={formData.level}
        onChange={(e) => setFormData({ ...formData, level: e.target.value })}
        required
      >
        <option value="">Chọn mức độ ngập</option>
        <option value="Nhẹ">Nhẹ - Đến mắt cá (~10cm)</option>
        <option value="Trung bình">Trung bình - Đến đầu gối (~30cm)</option>
        <option value="Nặng">Nặng - Ngập nửa xe (~50cm)</option>
      </select>

      <MapLocationPicker
        onLocationSelect={(lng, lat) => {
          setFormData({ ...formData, lng, lat });
        }}
      />

      <button type="submit" disabled={loading}>
        {loading ? 'Đang gửi...' : 'Gửi báo cáo'}
      </button>

      {result && result.data.verified_by_sensor && (
        <div className="success-badge">
          ✅ Đã được xác minh bởi hệ thống cảm biến
        </div>
      )}
    </form>
  );
};

// Component hiển thị báo cáo trên bản đồ
const CrowdReportsMap = () => {
  const [reports, setReports] = useState([]);

  useEffect(() => {
    fetch('/api/crowd-reports')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setReports(data.data);
        }
      });
  }, []);

  return (
    <MapContainer center={[10.776, 106.701]} zoom={13}>
      {reports.map(report => (
        <Marker
          key={report.id}
          position={[report.lat, report.lng]}
          icon={getMarkerIcon(report.validation_status, report.verified_by_sensor)}
        >
          <Popup>
            <div>
              <h3>{report.reporter_name}</h3>
              <p>Mức độ: <strong>{report.flood_level}</strong></p>
              {report.verified_by_sensor && (
                <p>✅ Đã xác minh bởi cảm biến</p>
              )}
              <p>Thời gian: {new Date(report.created_at).toLocaleString('vi-VN')}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};
```

---

### Vue.js Example

```vue
<template>
  <div class="report-form">
    <form @submit.prevent="submitReport">
      <input
        v-model="form.name"
        type="text"
        placeholder="Tên của bạn"
        required
      />
      
      <select v-model="form.level" required>
        <option value="">Chọn mức độ ngập</option>
        <option value="Nhẹ">Nhẹ - Đến mắt cá (~10cm)</option>
        <option value="Trung bình">Trung bình - Đến đầu gối (~30cm)</option>
        <option value="Nặng">Nặng - Ngập nửa xe (~50cm)</option>
      </select>

      <MapPicker @location-selected="setLocation" />

      <button type="submit" :disabled="loading">
        {{ loading ? 'Đang gửi...' : 'Gửi báo cáo' }}
      </button>
    </form>

    <div v-if="result" class="result-message">
      <p :class="result.data.verified_by_sensor ? 'success' : 'info'">
        {{ result.message }}
      </p>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      form: {
        name: '',
        reporter_id: this.userId || null,
        level: '',
        lng: null,
        lat: null
      },
      loading: false,
      result: null
    };
  },
  methods: {
    setLocation(lng, lat) {
      this.form.lng = lng;
      this.form.lat = lat;
    },
    async submitReport() {
      this.loading = true;
      try {
        const response = await fetch('/api/report-flood', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.form)
        });
        
        const data = await response.json();
        this.result = data;
        
        if (data.success) {
          // Reset form
          this.form.level = '';
          this.form.lng = null;
          this.form.lat = null;
        }
      } catch (error) {
        alert('Lỗi: ' + error.message);
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>
```

---

## 📱 Mobile App Integration

### React Native Example

```javascript
import { useState } from 'react';
import { View, Text, TextInput, Picker, Button, Alert } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

const ReportFloodScreen = ({ userId }) => {
  const [name, setName] = useState('');
  const [level, setLevel] = useState('');
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);

  const getCurrentLocation = () => {
    Geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lng: position.coords.longitude,
          lat: position.coords.latitude
        });
      },
      (error) => Alert.alert('Lỗi', 'Không thể lấy vị trí'),
      { enableHighAccuracy: true }
    );
  };

  const submitReport = async () => {
    if (!name || !level || !location) {
      Alert.alert('Lỗi', 'Vui lòng điền đầy đủ thông tin');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://your-api.com/api/report-flood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          reporter_id: userId,
          level,
          lng: location.lng,
          lat: location.lat
        })
      });

      const data = await response.json();
      
      if (data.success) {
        Alert.alert(
          'Thành công',
          data.message,
          [{ text: 'OK', onPress: () => {
            setName('');
            setLevel('');
            setLocation(null);
          }}]
        );
      } else {
        Alert.alert('Lỗi', data.error);
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể kết nối đến server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <TextInput
        placeholder="Tên của bạn"
        value={name}
        onChangeText={setName}
      />
      
      <Picker
        selectedValue={level}
        onValueChange={setLevel}
      >
        <Picker.Item label="Chọn mức độ ngập" value="" />
        <Picker.Item label="Nhẹ - Đến mắt cá" value="Nhẹ" />
        <Picker.Item label="Trung bình - Đến đầu gối" value="Trung bình" />
        <Picker.Item label="Nặng - Ngập nửa xe" value="Nặng" />
      </Picker>

      <Button title="Lấy vị trí hiện tại" onPress={getCurrentLocation} />
      
      {location && (
        <Text>Vị trí: {location.lat}, {location.lng}</Text>
      )}

      <Button
        title={loading ? 'Đang gửi...' : 'Gửi báo cáo'}
        onPress={submitReport}
        disabled={loading}
      />
    </View>
  );
};
```

---

## 🎯 Best Practices

### 1. Xử lý lỗi
```javascript
try {
  const response = await fetch('/api/report-flood', {...});
  const data = await response.json();
  
  if (!response.ok) {
    // Handle HTTP errors (400, 500, etc.)
    throw new Error(data.error || 'Có lỗi xảy ra');
  }
  
  // Success
  handleSuccess(data);
} catch (error) {
  // Handle network errors
  if (error.name === 'TypeError') {
    showError('Không thể kết nối đến server');
  } else {
    showError(error.message);
  }
}
```

### 2. Validation phía client
```javascript
const validateForm = (formData) => {
  const errors = {};
  
  if (!formData.name || formData.name.trim().length < 2) {
    errors.name = 'Tên phải có ít nhất 2 ký tự';
  }
  
  if (!['Nhẹ', 'Trung bình', 'Nặng'].includes(formData.level)) {
    errors.level = 'Vui lòng chọn mức độ ngập hợp lệ';
  }
  
  if (!formData.lng || !formData.lat) {
    errors.location = 'Vui lòng chọn vị trí trên bản đồ';
  }
  
  return errors;
};
```

### 3. Optimistic UI Updates
```javascript
// Thêm báo cáo vào danh sách ngay lập tức (trước khi server phản hồi)
const submitReport = async (formData) => {
  // Tạo báo cáo tạm thời
  const tempReport = {
    id: 'temp-' + Date.now(),
    ...formData,
    validation_status: 'pending',
    verified_by_sensor: false,
    created_at: new Date().toISOString()
  };
  
  // Thêm vào UI ngay
  addReportToList(tempReport);
  
  // Gửi request
  const response = await fetch('/api/report-flood', {...});
  const data = await response.json();
  
  // Cập nhật với dữ liệu thực từ server
  if (data.success) {
    updateReportInList(tempReport.id, {
      ...tempReport,
      id: data.data.id,
      validation_status: data.data.validation_status,
      verified_by_sensor: data.data.verified_by_sensor
    });
  }
};
```

---

## 📞 Hỗ trợ

Nếu có thắc mắc hoặc cần hỗ trợ, vui lòng liên hệ team Backend.

**Tài liệu liên quan:**
- [API_ENDPOINTS.md](./API_ENDPOINTS.md) - Tổng quan tất cả API
- [database/schema.sql](./database/schema.sql) - Cấu trúc database
