const emergencySubscriptionRepository = require('../repositories/emergencySubscriptionRepository');

const emergencySubscriptionController = {
    // Tạo subscription mới
    createSubscription: async (req, res) => {
        try {
            const { lng, lat, radius, notification_methods } = req.body;

            if (!lng || !lat) {
                return res.status(400).json({
                    success: false,
                    error: 'Thiếu thông tin: lng, lat'
                });
            }

            const data = await emergencySubscriptionRepository.createSubscription({
                user_id: req.user.id,
                lng: parseFloat(lng),
                lat: parseFloat(lat),
                radius: radius ? parseInt(radius) : 1000,
                notification_methods: notification_methods || ['email', 'sms']
            });

            res.status(201).json({
                success: true,
                message: 'Đăng ký khẩn thành công',
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Lấy subscriptions của user
    getMySubscriptions: async (req, res) => {
        try {
            const data = await emergencySubscriptionRepository.getSubscriptionsByUser(req.user.id);
            res.json({
                success: true,
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Cập nhật subscription
    updateSubscription: async (req, res) => {
        try {
            const { subscriptionId } = req.params;
            const updateData = req.body;

            const data = await emergencySubscriptionRepository.updateSubscription(
                parseInt(subscriptionId),
                updateData
            );

            res.json({
                success: true,
                message: 'Cập nhật subscription thành công',
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Xóa subscription
    deleteSubscription: async (req, res) => {
        try {
            const { subscriptionId } = req.params;
            await emergencySubscriptionRepository.deleteSubscription(parseInt(subscriptionId));
            res.json({
                success: true,
                message: 'Xóa subscription thành công'
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
};

module.exports = emergencySubscriptionController;

