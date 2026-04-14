const routingService = require('../services/routingService');
const routingRepository = require('../repositories/routingRepository');

function toNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

const routingController = {
    async getSafePath(req, res) {
        try {
            const start_lng = toNum(req.query.start_lng);
            const start_lat = toNum(req.query.start_lat);
            const end_lng = toNum(req.query.end_lng);
            const end_lat = toNum(req.query.end_lat);
            const vehicle_type = String(req.query.vehicle_type || 'motorbike');
            const nearest_node_max_m = req.query.nearest_node_max_m;

            if (start_lng == null || start_lat == null || end_lng == null || end_lat == null) {
                return res.status(400).json({
                    success: false,
                    error: 'Thiếu hoặc sai query: start_lng, start_lat, end_lng, end_lat'
                });
            }

            const data = await routingService.findSafePath({
                start_lng,
                start_lat,
                end_lng,
                end_lat,
                vehicle_type,
                nearest_node_max_m
            });
            return res.json({ success: true, data });
        } catch (err) {
            const status = /không tìm thấy|chưa có|không nằm trong đồ thị/i.test(err.message) ? 400 : 500;
            return res.status(status).json({ success: false, error: err.message });
        }
    },

    async updateManualFloodDepthBatch(req, res) {
        try {
            const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];
            if (updates.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Body phải có updates: [{ edge_id, manual_flood_depth_cm|null }, ...]'
                });
            }

            const normalized = updates.map((u, i) => {
                const edgeId = Number(u.edge_id);
                if (!Number.isInteger(edgeId) || edgeId <= 0) {
                    throw new Error(`updates[${i}].edge_id không hợp lệ`);
                }
                if (u.manual_flood_depth_cm == null) {
                    return { edge_id: edgeId, manual_flood_depth_cm: null };
                }
                const depth = Number(u.manual_flood_depth_cm);
                if (!Number.isFinite(depth) || depth < 0 || depth > 500) {
                    throw new Error(`updates[${i}].manual_flood_depth_cm phải trong [0, 500] hoặc null`);
                }
                return { edge_id: edgeId, manual_flood_depth_cm: depth };
            });

            const updated = await routingRepository.updateManualFloodDepthBatch(normalized);
            return res.json({
                success: true,
                message: `Đã cập nhật manual_flood_depth_cm cho ${updated.length}/${normalized.length} edge`,
                data: updated
            });
        } catch (err) {
            return res.status(400).json({ success: false, error: err.message });
        }
    }
};

module.exports = routingController;
