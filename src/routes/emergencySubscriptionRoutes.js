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
 *                   enum: [email, sms, push]
 *                 default: [email, sms]
 *                 example: [email, sms]
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
 *                   enum: [email, sms, push]
 *                 example: [email, sms]
 *                 description: Phương thức thông báo
 *               is_active:
 *                 type: boolean
 *                 example: true
 *                 description: Kích hoạt/vô hiệu hóa subscription
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

