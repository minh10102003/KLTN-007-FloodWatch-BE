const express = require('express');
const router = express.Router();
const emergencySubscriptionController = require('../controllers/emergencySubscriptionController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /api/emergency-subscriptions:
 *   post:
 *     summary: Tạo subscription đăng ký nhận cảnh báo khẩn
 *     tags: [Emergency Subscription]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - lng
 *               - lat
 *             properties:
 *               lng:
 *                 type: number
 *                 format: float
 *                 example: 106.721
 *                 description: Longitude
 *               lat:
 *                 type: number
 *                 format: float
 *                 example: 10.798
 *                 description: Latitude
 *               radius:
 *                 type: integer
 *                 default: 1000
 *                 example: 1000
 *                 description: Bán kính nhận cảnh báo (mét)
 *               notification_methods:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [email, webhook, telegram, sms, push]
 *                 default: [email]
 *                 example: [email, webhook]
 *               name:
 *                 type: string
 *                 maxLength: 200
 *                 nullable: true
 *                 description: Tên hiển thị do user đặt (FE getSubscriptionDisplayName)
 *               display_meta:
 *                 type: object
 *                 additionalProperties: true
 *                 description: JSON mở rộng cho FE (icon, màu, …). Có thể gửi displayMeta (camelCase).
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 *       400:
 *         description: Thiếu thông tin lng, lat
 */
router.post('/', authenticate, emergencySubscriptionController.createSubscription);

/**
 * @swagger
 * /api/emergency-subscriptions/my-subscriptions:
 *   get:
 *     summary: Lấy tất cả subscriptions của user hiện tại
 *     tags: [Emergency Subscription]
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
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       lng:
 *                         type: number
 *                       lat:
 *                         type: number
 *                       radius:
 *                         type: integer
 *                       notification_methods:
 *                         type: array
 *                         items:
 *                           type: string
 *                       name:
 *                         type: string
 *                         nullable: true
 *                       display_meta:
 *                         type: object
 *                         additionalProperties: true
 *                       is_active:
 *                         type: boolean
 */
router.get('/my-subscriptions', authenticate, emergencySubscriptionController.getMySubscriptions);

/**
 * @swagger
 * /api/emergency-subscriptions/{subscriptionId}:
 *   put:
 *     summary: Cập nhật subscription
 *     tags: [Emergency Subscription]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subscriptionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của subscription
 *         example: 1
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               lng:
 *                 type: number
 *                 format: float
 *                 example: 106.721
 *                 description: Longitude mới
 *               lat:
 *                 type: number
 *                 format: float
 *                 example: 10.798
 *                 description: Latitude mới
 *               radius:
 *                 type: integer
 *                 example: 1500
 *                 description: Bán kính mới (mét)
 *               notification_methods:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [email, webhook, telegram, sms, push]
 *                 example: [email, telegram]
 *                 description: Phương thức thông báo
 *               is_active:
 *                 type: boolean
 *                 example: true
 *                 description: Kích hoạt/vô hiệu hóa subscription
 *               name:
 *                 type: string
 *                 maxLength: 200
 *                 nullable: true
 *                 description: Đổi tên hiển thị (gửi null hoặc chuỗi rỗng sau trim → lưu null)
 *               display_meta:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Ghi đè metadata hiển thị (có thể gửi displayMeta)
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
 *                   example: Cập nhật subscription thành công
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     lng:
 *                       type: number
 *                     lat:
 *                       type: number
 *                     radius:
 *                       type: integer
 *                     notification_methods:
 *                       type: array
 *                     name:
 *                       type: string
 *                       nullable: true
 *                     display_meta:
 *                       type: object
 *                     is_active:
 *                       type: boolean
 *       404:
 *         description: Subscription không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:subscriptionId', authenticate, emergencySubscriptionController.updateSubscription);

/**
 * @swagger
 * /api/emergency-subscriptions/{subscriptionId}:
 *   delete:
 *     summary: Xóa subscription
 *     tags: [Emergency Subscription]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subscriptionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của subscription
 *         example: 1
 *     responses:
 *       200:
 *         description: Xóa thành công
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
 *                   example: Xóa subscription thành công
 *       404:
 *         description: Subscription không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:subscriptionId', authenticate, emergencySubscriptionController.deleteSubscription);

module.exports = router;

