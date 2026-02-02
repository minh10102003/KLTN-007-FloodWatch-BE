# 📝 Hướng Dẫn Chạy Database Migration

## Cách 1: Sử dụng Node.js Script (Khuyến nghị)

Nếu bạn không có `psql` trong PATH, sử dụng script Node.js:

```bash
npm run migrate
```

Script này sẽ:
- Đọc file `database/add_new_features.sql`
- Kết nối đến database từ `.env`
- Chạy tất cả các câu lệnh SQL
- Tự động rollback nếu có lỗi

## Cách 2: Sử dụng psql (Nếu đã cài PostgreSQL)

### Windows (PowerShell)
```powershell
# Tìm đường dẫn psql (thường ở đây)
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -d your_database -f database/add_new_features.sql
```

Hoặc thêm PostgreSQL vào PATH:
1. Mở System Properties > Environment Variables
2. Thêm `C:\Program Files\PostgreSQL\15\bin` vào PATH
3. Khởi động lại PowerShell

### Linux/Mac
```bash
psql -U postgres -d your_database -f database/add_new_features.sql
```

## Cách 3: Sử dụng pgAdmin

1. Mở pgAdmin
2. Kết nối đến database
3. Click chuột phải vào database > Query Tool
4. Mở file `database/add_new_features.sql`
5. Chạy (F5)

## Cách 4: Copy-paste trực tiếp

1. Mở file `database/add_new_features.sql`
2. Copy toàn bộ nội dung
3. Mở PostgreSQL client (psql, pgAdmin, DBeaver, etc.)
4. Paste và chạy

## Kiểm tra Migration

Sau khi chạy migration, kiểm tra các bảng đã được tạo:

```sql
-- Kiểm tra các bảng mới
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'alerts', 'report_evaluations', 'emergency_subscriptions', 'ota_updates', 'energy_logs');

-- Kiểm tra triggers
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public';
```

## Lưu ý

- Đảm bảo file `.env` đã được cấu hình đúng
- Database phải đã có các bảng cơ bản từ `schema.sql`
- Migration có thể chạy nhiều lần (sử dụng `IF NOT EXISTS`)

## Troubleshooting

### Lỗi: "relation already exists"
- Bảng đã tồn tại, có thể bỏ qua hoặc xóa bảng cũ trước

### Lỗi: "permission denied"
- Kiểm tra quyền của user database trong `.env`

### Lỗi: "extension postgis does not exist"
- Cài đặt PostGIS extension:
  ```sql
  CREATE EXTENSION IF NOT EXISTS postgis;
  ```

