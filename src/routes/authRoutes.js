const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, requireAdmin } = require('../middleware/auth');

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Đăng ký user mới
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: user123
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *               full_name:
 *                 type: string
 *                 example: Nguyễn Văn A
 *               phone:
 *                 type: string
 *                 example: 0123456789
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Đăng ký thành công
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     access_token:
 *                       type: string
 *                       description: JWT access (ngắn hạn), header Authorization Bearer
 *                     refresh_token:
 *                       type: string
 *                       description: Dùng cho POST /api/auth/refresh (lưu an toàn, không log)
 *                     session_token:
 *                       type: string
 *                       format: uuid
 *                       description: Định danh phiên đăng nhập (gửi kèm khi refresh)
 *                     token:
 *                       type: string
 *                       description: Alias của access_token (tương thích client cũ)
 *       400:
 *         description: Lỗi validation hoặc username/email đã tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/register', authController.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Đăng nhập (User/Admin/Moderator)
 *     tags: [Authentication]
 *     description: |
 *       API đăng nhập cho tất cả users (user, admin, moderator).
 *       
 *       **Ví dụ đăng nhập Admin:**
 *       - Username: `admin`
 *       - Password: `admin123` (mặc định, sau khi chạy `npm run create-admin`)
 *       
 *       **Ví dụ đăng nhập User thường:**
 *       - Username: `user123`
 *       - Password: `password123`
 *       
 *       Trả về **access_token** (JWT ngắn hạn), **refresh_token** và **session_token** (UUID phiên).
 *       Gửi access_token qua header `Authorization: Bearer <access_token>`. Khi 401 do hết hạn access, gọi `POST /api/auth/refresh`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: Username (có thể là user, admin, hoặc moderator)
 *                 example: admin
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Mật khẩu
 *                 example: admin123
 *           examples:
 *             admin:
 *               summary: Đăng nhập Admin
 *               value:
 *                 username: admin
 *                 password: admin123
 *             user:
 *               summary: Đăng nhập User thường
 *               value:
 *                 username: user123
 *                 password: password123
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Đăng nhập thành công
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     access_token:
 *                       type: string
 *                     refresh_token:
 *                       type: string
 *                     session_token:
 *                       type: string
 *                       format: uuid
 *                     token:
 *                       type: string
 *                       description: Alias access_token
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *             examples:
 *               admin:
 *                 summary: Response khi đăng nhập Admin
 *                 value:
 *                   success: true
 *                   message: Đăng nhập thành công
 *                   data:
 *                     user:
 *                       id: 1
 *                       username: admin
 *                       email: admin@hcm-flood.gov.vn
 *                       full_name: System Administrator
 *                       role: admin
 *                       is_active: true
 *                     access_token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     refresh_token: base64url...
 *                     session_token: 550e8400-e29b-41d4-a716-446655440000
 *                     token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *               user:
 *                 summary: Response khi đăng nhập User
 *                 value:
 *                   success: true
 *                   message: Đăng nhập thành công
 *                   data:
 *                     user:
 *                       id: 2
 *                       username: user123
 *                       email: user@example.com
 *                       full_name: Nguyễn Văn A
 *                       role: user
 *                       is_active: true
 *                     access_token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     refresh_token: base64url...
 *                     session_token: 550e8400-e29b-41d4-a716-446655440001
 *                     token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       400:
 *         description: Thiếu thông tin username hoặc password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missingFields:
 *                 summary: Thiếu thông tin
 *                 value:
 *                   success: false
 *                   error: "Thiếu thông tin: username, password"
 *       401:
 *         description: Username hoặc password không đúng, hoặc tài khoản bị vô hiệu hóa
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               wrongCredentials:
 *                 summary: Sai username hoặc password
 *                 value:
 *                   success: false
 *                   error: Username hoặc password không đúng
 *               inactiveAccount:
 *                 summary: Tài khoản bị vô hiệu hóa
 *                 value:
 *                   success: false
 *                   error: Tài khoản đã bị vô hiệu hóa
 */
router.post('/login', authController.login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Làm mới access JWT bằng refresh token
 *     tags: [Authentication]
 *     description: |
 *       Mỗi lần gọi thành công, server trả refresh_token mới (rotation). Client phải lưu cả access_token và refresh_token mới.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refresh_token, session_token]
 *             properties:
 *               refresh_token:
 *                 type: string
 *               session_token:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Token mới
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     access_token: { type: string }
 *                     refresh_token: { type: string }
 *                     session_token: { type: string, format: uuid }
 *                     token: { type: string, description: alias access_token }
 *       401:
 *         description: Refresh/session không hợp lệ hoặc hết hạn
 */
router.post('/refresh', authController.refresh);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Đăng xuất (set is_online = false)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Lấy thông tin profile của user hiện tại
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/profile', authenticate, authController.getProfile);

/**
 * @swagger
 * /api/auth/profile-icons:
 *   get:
 *     summary: Lấy danh sách icon ảnh đại diện có thể chọn
 *     tags: [Authentication]
 *     description: Chỉ được chọn một trong các icon này (không tải ảnh từ máy).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách icon (name, url)
 *       401:
 *         description: Chưa đăng nhập
 */
router.get('/profile-icons', authenticate, authController.getProfileIcons);

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     summary: Cập nhật profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               full_name:
 *                 type: string
 *                 example: Nguyễn Văn B
 *                 description: Họ và tên đầy đủ
 *               phone:
 *                 type: string
 *                 example: 0987654321
 *                 description: Số điện thoại
 *               email:
 *                 type: string
 *                 format: email
 *                 example: newemail@example.com
 *                 description: Email mới
 *               avatar:
 *                 type: string
 *                 example: cat.png
 *                 description: Tên file icon ảnh đại diện (chỉ chọn từ GET /api/auth/profile-icons)
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Cập nhật profile thành công
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Lỗi validation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/profile', authenticate, authController.updateProfile);

/**
 * @swagger
 * /api/auth/change-password:
 *   put:
 *     summary: Đổi mật khẩu
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - old_password
 *               - new_password
 *             properties:
 *               old_password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *                 description: Mật khẩu cũ
 *               new_password:
 *                 type: string
 *                 format: password
 *                 example: newpassword456
 *                 description: Mật khẩu mới
 *     responses:
 *       200:
 *         description: Đổi mật khẩu thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Đổi mật khẩu thành công
 *       400:
 *         description: Mật khẩu cũ không đúng hoặc thiếu thông tin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/change-password', authenticate, authController.changePassword);

// ---------- Chỉ Admin: quản lý user, phân quyền ----------
/**
 * @swagger
 * /api/auth/users:
 *   get:
 *     summary: Lấy danh sách users (chỉ Admin)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100, maximum: 500 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200:
 *         description: Danh sách users
 *       403:
 *         description: Chỉ admin mới có quyền
 */
router.get('/users', authenticate, requireAdmin, authController.getAllUsers);

/**
 * @swagger
 * /api/auth/users:
 *   post:
 *     summary: Tạo tài khoản mới (chỉ Admin) – user, moderator hoặc admin
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password, role]
 *             properties:
 *               username: { type: string, example: mod01 }
 *               email: { type: string, format: email, example: mod01@hcmflood.vn }
 *               password: { type: string, format: password, example: SecurePass123 }
 *               role: { type: string, enum: [user, moderator, admin], example: moderator }
 *               full_name: { type: string, example: Moderator One }
 *               phone: { type: string }
 *     responses:
 *       201:
 *         description: "Tạo tài khoản thành công (data: user, không trả token)"
 *       400:
 *         description: Thiếu field, role không hợp lệ, hoặc username/email đã tồn tại
 *       403:
 *         description: Chỉ admin mới có quyền
 */
router.post('/users', authenticate, requireAdmin, authController.createUser);

/**
 * @swagger
 * /api/auth/users/{userId}/role:
 *   put:
 *     summary: Gán role cho user (chỉ Admin)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [user, moderator, admin]
 *     responses:
 *       200:
 *         description: Cập nhật role thành công
 *       400:
 *         description: Role không hợp lệ hoặc không thể tự hạ quyền (admin duy nhất)
 *       403:
 *         description: Chỉ admin mới có quyền
 *       404:
 *         description: Không tìm thấy user
 */
router.put('/users/:userId/role', authenticate, requireAdmin, authController.assignRole);

/**
 * @swagger
 * /api/auth/users/{userId}/active:
 *   put:
 *     summary: Bật/tắt tài khoản user (chỉ Admin)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [is_active]
 *             properties:
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Cập nhật trạng thái thành công
 *       403:
 *         description: Chỉ admin mới có quyền
 *       404:
 *         description: Không tìm thấy user
 */
router.put('/users/:userId/active', authenticate, requireAdmin, authController.setActiveStatus);

/**
 * @swagger
 * /api/auth/users/{userId}/recompute-reliability:
 *   post:
 *     summary: Tính lại điểm tin cậy reporter từ lịch sử (Cách A). Chỉ Admin.
 *     tags: [Authentication]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: userId, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: "Đã tính lại, data: { userId, reporter_reliability }" }
 *       403: { description: Chỉ admin }
 *       404: { description: Không tìm thấy user }
 */
router.post('/users/:userId/recompute-reliability', authenticate, requireAdmin, authController.recomputeReporterReliability);

module.exports = router;
