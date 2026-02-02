# 📖 Hướng Dẫn Swagger Documentation

## 🚀 Cài Đặt

Đã cài đặt các packages cần thiết:
- `swagger-ui-express` - UI cho Swagger
- `swagger-jsdoc` - Parse JSDoc comments thành OpenAPI spec

## 📍 Truy Cập Swagger UI

Sau khi khởi động server, truy cập:

```
http://localhost:3000/api-docs
```

Hoặc lấy JSON spec:
```
http://localhost:3000/api-docs.json
```

## 📝 Cấu Trúc

### 1. File Cấu Hình
- `src/config/swagger.js` - Cấu hình Swagger chính

### 2. JSDoc Comments
Các routes đã được thêm JSDoc comments với format:
```javascript
/**
 * @swagger
 * /api/endpoint:
 *   get:
 *     summary: Mô tả ngắn
 *     tags: [Tag Name]
 *     responses:
 *       200:
 *         description: Thành công
 */
```

## 🎯 Các Tags Đã Định Nghĩa

1. **Authentication** - Đăng ký, đăng nhập, profile
2. **Sensors** - Quản lý sensors
3. **Flood Data** - Dữ liệu ngập lụt
4. **Crowd Reports** - Báo cáo từ người dân
5. **Alerts** - Cảnh báo
6. **Report Moderation** - Kiểm duyệt báo cáo
7. **Report Evaluation** - Đánh giá báo cáo
8. **Emergency Subscription** - Đăng ký khẩn
9. **Heatmap** - Dữ liệu heatmap
10. **OTA Updates** - Quản lý OTA
11. **Energy Monitoring** - Theo dõi năng lượng

## 🔐 Authentication

Swagger đã được cấu hình để hỗ trợ Bearer Token authentication:

1. Đăng nhập qua endpoint `/api/auth/login`
2. Copy token từ response
3. Click nút "Authorize" ở góc trên bên phải Swagger UI
4. Nhập: `Bearer <your-token>`
5. Click "Authorize"

Sau đó tất cả các request sẽ tự động thêm header `Authorization: Bearer <token>`

## 📊 Schemas Đã Định Nghĩa

- `User` - Thông tin user
- `Sensor` - Thông tin sensor
- `FloodData` - Dữ liệu ngập lụt
- `Alert` - Cảnh báo
- `CrowdReport` - Báo cáo từ người dân
- `Error` - Response lỗi
- `Success` - Response thành công

## 🛠️ Thêm API Mới Vào Swagger

Để thêm API mới vào Swagger, thêm JSDoc comments vào file route:

```javascript
/**
 * @swagger
 * /api/your-endpoint:
 *   post:
 *     summary: Mô tả API
 *     tags: [Your Tag]
 *     security:
 *       - bearerAuth: []  # Nếu cần authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               field1:
 *                 type: string
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/YourSchema'
 *       400:
 *         description: Lỗi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/your-endpoint', controller.yourMethod);
```

## 🎨 Tùy Chỉnh

Có thể tùy chỉnh Swagger UI trong `src/config/swagger.js`:
- Thay đổi title, description
- Thêm servers
- Thêm schemas mới
- Thay đổi CSS

## 📝 Lưu ý

- Swagger UI tự động reload khi server restart
- JSDoc comments phải đúng format OpenAPI 3.0
- Có thể export JSON spec để import vào Postman hoặc tools khác

