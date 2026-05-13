const emergencySubscriptionRepository = require('../repositories/emergencySubscriptionRepository');

function trimSubscriptionName(name) {
    if (name == null) return null;
    const s = String(name).trim();
    if (!s) return null;
    return s.slice(0, 200);
}

/**
 * @param {object} body - req.body
 * @param {'create'|'update'} mode - create: thiếu key → null / {}; update: undefined → bỏ qua cột
 */
function pickDisplayMeta(body, mode) {
    const raw = body.display_meta !== undefined ? body.display_meta : body.displayMeta;
    if (mode === 'update' && raw === undefined) return undefined;
    if (raw === null || raw === undefined) return mode === 'create' ? {} : {};
    if (typeof raw === 'string') {
        try {
            const o = JSON.parse(raw);
            return typeof o === 'object' && o !== null && !Array.isArray(o) ? o : {};
        } catch {
            return {};
        }
    }
    if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
    return {};
}

const emergencySubscriptionController = {
    // Tạo subscription mới
    createSubscription: async (req, res) => {
        try {
            const { lng, lat, radius, notification_methods, name, display_meta, displayMeta } = req.body;

            if (!lng || !lat) {
                return res.status(400).json({
                    success: false,
                    error: 'Thiếu thông tin: lng, lat',
                });
            }

            const displayMetaObj = pickDisplayMeta(
                { display_meta, displayMeta },
                'create'
            );

            const data = await emergencySubscriptionRepository.createSubscription({
                user_id: req.user.id,
                lng: parseFloat(lng),
                lat: parseFloat(lat),
                radius: radius ? parseInt(radius, 10) : 1000,
                notification_methods: notification_methods || ['email'],
                name: trimSubscriptionName(name),
                display_meta: displayMetaObj,
            });

            res.status(201).json({
                success: true,
                message: 'Đăng ký khẩn thành công',
                data: data,
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
                data: data,
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Cập nhật subscription
    updateSubscription: async (req, res) => {
        try {
            const { subscriptionId } = req.params;
            const id = parseInt(subscriptionId, 10);
            const existing = await emergencySubscriptionRepository.getSubscriptionById(id);
            if (!existing || existing.user_id !== req.user.id) {
                return res.status(404).json({ success: false, error: 'Không tìm thấy subscription' });
            }

            const {
                lng,
                lat,
                radius,
                notification_methods,
                is_active,
                name,
                display_meta,
                displayMeta,
            } = req.body;

            const updateData = {};
            if (lng !== undefined && lat !== undefined) {
                updateData.lng = parseFloat(lng);
                updateData.lat = parseFloat(lat);
            }
            if (radius !== undefined) updateData.radius = parseInt(radius, 10);
            if (notification_methods !== undefined) updateData.notification_methods = notification_methods;
            if (is_active !== undefined) updateData.is_active = is_active;
            if (name !== undefined) updateData.name = trimSubscriptionName(name);
            const metaPick = pickDisplayMeta({ display_meta, displayMeta }, 'update');
            if (metaPick !== undefined) {
                updateData.display_meta = metaPick;
            }

            const data = await emergencySubscriptionRepository.updateSubscription(id, updateData);

            res.json({
                success: true,
                message: 'Cập nhật subscription thành công',
                data: data,
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Xóa subscription
    deleteSubscription: async (req, res) => {
        try {
            const { subscriptionId } = req.params;
            const id = parseInt(subscriptionId, 10);
            const existing = await emergencySubscriptionRepository.getSubscriptionById(id);
            if (!existing || existing.user_id !== req.user.id) {
                return res.status(404).json({ success: false, error: 'Không tìm thấy subscription' });
            }
            await emergencySubscriptionRepository.deleteSubscription(id);
            res.json({
                success: true,
                message: 'Xóa subscription thành công',
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },
};

module.exports = emergencySubscriptionController;
