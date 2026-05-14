# FE — Họ tên, email, SĐT (đăng ký & cập nhật profile)

Backend validate **họ tên thật**, **email dùng lâu dài** (chặn domain tạm), **SĐT di động VN**. Lỗi trả `400` với `error` (message chính) và thường kèm `details` map theo field (`full_name`, `email`, `phone`).

---

## 1. Cập nhật profile (user đã đăng nhập)

| | |
|---|---|
| **Method / URL** | `PUT /api/auth/profile/edit` |
| **Header** | `Authorization: Bearer <access_token>` |
| **Content-Type** | `application/json` |

**Body bắt buộc mỗi lần gọi**

| Field | Bắt buộc | Ghi chú |
|--------|----------|---------|
| `full_name` **hoặc** `fullName` | Có (một trong hai) | Họ tên hiển thị |
| `email` | Có | Chuẩn hóa lowercase |
| `phone` | Có | Lưu dạng `0xxxxxxxxx` (di động VN) |
| `avatar` | Không | Chỉ giá trị từ `GET /api/auth/profile-icons` |

**Ví dụ body**

```json
{
  "full_name": "Nguyễn Văn A",
  "email": "user@example.com",
  "phone": "0912345678",
  "avatar": "cat.png"
}
```

**200** — `success`, `message`, `data` (object user public, giống `GET /api/auth/profile`).

**400** — ví dụ:

```json
{
  "success": false,
  "error": "Số điện thoại không hợp lệ. Nhập số di động Việt Nam (vd: 09xxxxxxxx, 03xxxxxxxx, hoặc +84…).",
  "details": {
    "phone": "Số điện thoại không hợp lệ. …"
  }
}
```

**400** email trùng user khác: `error` + `details.email`.

---

## 2. Đọc profile

`GET /api/auth/profile` — Bearer JWT, chỉ đọc.

---

## 3. Đăng ký

`POST /api/auth/register` — body bắt buộc: `username`, `email`, `password`, **`full_name`**, **`phone`**. Cùng rule validate như trên.

---

## 4. Admin tạo user

`POST /api/auth/users` (JWT admin) — bắt buộc thêm `full_name`, `phone` (cùng validate).

---

## 5. Quy tắc validate (tóm tắt)

- **Họ tên:** không rỗng; 2–100 ký tự; ít nhất 2 chữ cái Unicode; chỉ chữ, khoảng trắng, `.'-`; chặn từ khóa kiểu `test`, `xxx`, `admin`, …
- **Email:** định dạng chặt (local + domain + TLD); chặn domain dùng một lần (mailinator, yopmail, … — danh sách trong code).
- **SĐT:** di động VN `0[35789]` + 8 chữ số; chấp nhận nhập `+84…` (backend chuẩn hóa về `0…`).

---

## 6. Icon avatar

`GET /api/auth/profile-icons` — Bearer; chỉ được chọn `name` trong danh sách trả về khi gửi `avatar` ở bước (1).
