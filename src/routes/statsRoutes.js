const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const { authenticate, requireAdmin, requireModerator } = require('../middleware/auth');

/**
 * @swagger
 * /api/stats/online-count:
 *   get:
 *     summary: Số user đang online (công khai)
 *     description: Trả về chỉ số lượng. Dùng cho admin, user, khách – không cần đăng nhập.
 *     tags: [Stats]
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object, properties: { count: { type: integer } } }
 *       500:
 *         description: Lỗi server
 */
router.get('/stats/online-count', statsController.getOnlineUsersCount);
router.get('/stats/online-users/count', statsController.getOnlineUsersCount);

/**
 * @swagger
 * /api/stats/online-users:
 *   get:
 *     summary: Lấy danh sách user đang online
 *     description: User "online" = cột is_online = true trong bảng users (set khi đăng nhập, bỏ khi đăng xuất). Chỉ admin.
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách user online
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     online_users:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: integer }
 *                           username: { type: string }
 *                           email: { type: string }
 *                           full_name: { type: string }
 *                           phone: { type: string }
 *                           role: { type: string }
 *                           last_login: { type: string, format: date-time }
 *                           is_online: { type: boolean }
 *                     count: { type: integer }
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 *       403:
 *         description: Không có quyền (chỉ admin)
 *       500:
 *         description: Lỗi server
 */
router.get('/stats/online-users', authenticate, requireAdmin, statsController.getOnlineUsers);

/**
 * @swagger
 * /api/stats/reports:
 *   get:
 *     summary: Thống kê báo cáo theo giờ/ngày (Moderator/Admin)
 *     description: Dùng cho biểu đồ lượng tin báo tại các điểm đen ngập Bình Thạnh.
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: groupBy
 *         schema: { type: string, enum: [hour, day] }
 *         description: Nhóm theo giờ hoặc ngày (mặc định day)
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *         description: Từ thời điểm (ISO), mặc định 7 ngày trước
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *         description: Đến thời điểm (ISO), mặc định hiện tại
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     groupBy: { type: string }
 *                     series: { type: array, items: { type: object, properties: { period: {}, count: { type: integer } } } }
 *       403:
 *         description: Chỉ moderator hoặc admin
 *       500:
 *         description: Lỗi server
 */
router.get('/stats/reports', authenticate, requireModerator, statsController.getReportStats);

/**
 * @swagger
 * /api/stats/monthly-visits:
 *   get:
 *     summary: Lượt truy cập trong tháng (công khai)
 *     description: Đếm số request tới /api trong tháng. Admin, user, khách đều gọi được – không cần đăng nhập.
 *     tags: [Stats]
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *         description: Năm (mặc định năm hiện tại)
 *       - in: query
 *         name: month
 *         schema: { type: integer, minimum: 1, maximum: 12 }
 *         description: Tháng 1-12 (mặc định tháng hiện tại)
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     year: { type: integer }
 *                     month: { type: integer }
 *                     count: { type: integer }
 *       500:
 *         description: Lỗi server
 */
router.get('/stats/monthly-visits', statsController.getMonthlyVisits);

module.exports = router;
