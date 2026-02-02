# Hướng dẫn lấy Bearer Token để test API

## 🔑 Cách 1: Sử dụng Swagger UI (Khuyến nghị)

### Bước 1: Truy cập Swagger UI
```
http://localhost:3000/api-docs
```

### Bước 2: Tìm endpoint Login
- Tìm tag **"Authentication"**
- Tìm endpoint `POST /api/auth/login`
- Click **"Try it out"**

### Bước 3: Nhập thông tin đăng nhập
```json
{
  "username": "admin",
  "password": "admin123"
}
```

### Bước 4: Execute và copy token
- Click **"Execute"**
- Xem Response body, tìm field `data.token`
- Copy toàn bộ token (chuỗi dài bắt đầu bằng `eyJ...`)

### Bước 5: Authorize trong Swagger
- Click nút **"Authorize"** (🔒 màu xanh) ở đầu trang
- Nhập: `Bearer <paste-token-ở-đây>`
- Click **"Authorize"** → **"Close"**
- Bây giờ tất cả API cần auth sẽ tự động dùng token này

---

## 🔑 Cách 2: Sử dụng cURL

### Đăng nhập và lấy token:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

### Response sẽ trả về:
```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": {
    "user": {...},
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Sử dụng token để gọi API khác:
```bash
curl -X GET http://localhost:3000/api/sensors \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 🔑 Cách 3: Sử dụng Postman

### Bước 1: Tạo request Login
- Method: `POST`
- URL: `http://localhost:3000/api/auth/login`
- Body (raw JSON):
  ```json
  {
    "username": "admin",
    "password": "admin123"
  }
  ```

### Bước 2: Lấy token từ response
- Send request
- Copy token từ response body

### Bước 3: Set token cho các request khác
- Tạo request mới (ví dụ: `GET /api/sensors`)
- Tab **Authorization**
- Type: **Bearer Token**
- Token: `<paste-token-ở-đây>`

---

## 🔑 Cách 4: Sử dụng JavaScript/Node.js

```javascript
// Đăng nhập và lấy token
const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    username: 'admin',
    password: 'admin123'
  })
});

const data = await response.json();
const token = data.data.token; // Lấy token từ đây

// Sử dụng token cho các API khác
const sensorsResponse = await fetch('http://localhost:3000/api/sensors', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

---

## 📝 Lưu ý quan trọng

1. **Token có thời hạn**: Token JWT có thời hạn 7 ngày (theo config). Sau khi hết hạn, cần đăng nhập lại.

2. **Format Bearer Token**: 
   - ✅ Đúng: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - ❌ Sai: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (thiếu "Bearer ")
   - ❌ Sai: `Bearer<token>` (thiếu khoảng trắng)

3. **Tạo Admin User**: Nếu chưa có admin user, chạy:
   ```bash
   npm run create-admin
   ```

4. **Token trong Swagger**: Sau khi authorize trong Swagger UI, token sẽ được lưu và tự động dùng cho tất cả request trong session đó.

---

## 🎯 Ví dụ thực tế

### Test API cần authentication (ví dụ: GET /api/sensors)

**Trong Swagger UI:**
1. Đã authorize với token (theo Cách 1)
2. Tìm endpoint `GET /api/sensors`
3. Click "Try it out" → "Execute"
4. ✅ Request sẽ tự động có header `Authorization: Bearer <token>`

**Với cURL:**
```bash
# Bước 1: Đăng nhập và lấy token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | jq -r '.data.token')

# Bước 2: Sử dụng token
curl -X GET http://localhost:3000/api/sensors \
  -H "Authorization: Bearer $TOKEN"
```

---

## ❓ Troubleshooting

### Lỗi: "Unauthorized" hoặc "Token không hợp lệ"
- ✅ Kiểm tra đã thêm "Bearer " trước token chưa
- ✅ Kiểm tra token còn hạn không (đăng nhập lại nếu cần)
- ✅ Kiểm tra token đã copy đầy đủ chưa (không bị cắt)

### Lỗi: "Username hoặc password không đúng"
- ✅ Chạy `npm run create-admin` để tạo admin user
- ✅ Kiểm tra username/password đúng chưa

### Token không tự động trong Swagger
- ✅ Đảm bảo đã click "Authorize" và nhập token
- ✅ Refresh trang và authorize lại

