const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

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
 *                     token:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
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
 *       Sau khi đăng nhập thành công, token JWT sẽ được trả về trong response.
 *       Sử dụng token này để xác thực các API cần authentication (thêm header `Authorization: Bearer <token>`).
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
 *                       description: Thông tin user (bao gồm role: user/admin/moderator)
 *                     token:
 *                       type: string
 *                       description: JWT token để sử dụng cho các API cần authentication
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTY5OTk5OTk5OSwiZXhwIjoxNzAwNTk5OTk5fQ.example
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
 *                     token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       400:
 *         description: Thiếu thông tin username hoặc password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error: Thiếu thông tin: username, password
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

module.exports = router;
