const chatRepository = require('../repositories/chatRepository');
const geminiChatService = require('../services/geminiChatService');

const chatController = {
    /**
     * POST /api/chat
     * Body: { message, history?, account_id?, area? }
     */
    postChat: async (req, res) => {
        try {
            const { message, history = [], account_id: accountId, area } = req.body || {};

            if (!geminiChatService.getApiKey()) {
                return res.status(503).json({
                    success: false,
                    error: 'Dịch vụ chat AI chưa sẵn sàng (thiếu GEMINI_API_KEY trên server).',
                    reply: null
                });
            }

            const msg = String(message || '').trim();
            if (!msg) {
                return res.status(400).json({
                    success: false,
                    error: 'Tin nhắn không được để trống',
                    reply: null
                });
            }

            if (msg.length > geminiChatService.MAX_MESSAGE_CHARS) {
                return res.status(400).json({
                    success: false,
                    error: `Tin nhắn tối đa ${geminiChatService.MAX_MESSAGE_CHARS} ký tự`,
                    reply: null
                });
            }

            const sensorSnapshot = await chatRepository.getChatSensorSnapshot(area || null);
            const { reply, model, sensor_count } = await geminiChatService.sendChatMessage(
                msg,
                history,
                sensorSnapshot
            );

            res.json({
                success: true,
                reply,
                timestamp: new Date().toISOString(),
                meta: {
                    model,
                    sensor_count,
                    account_id: accountId ? String(accountId).slice(0, 64) : undefined
                }
            });
        } catch (err) {
            if (err.code === 'EMPTY_MESSAGE') {
                return res.status(400).json({ success: false, error: err.message, reply: null });
            }
            if (err.code === 'GEMINI_NOT_CONFIGURED') {
                return res.status(503).json({ success: false, error: err.message, reply: null });
            }

            console.error('[chat] Gemini error:', err.message);
            const status = err.status === 429 || /quota|rate/i.test(err.message) ? 429 : 502;
            res.status(status).json({
                success: false,
                error:
                    status === 429
                        ? 'Hệ thống AI đang quá tải. Vui lòng thử lại sau.'
                        : 'Không thể nhận phản hồi từ AI. Vui lòng thử lại.',
                reply: null
            });
        }
    },

    /**
     * GET /api/flood-status
     * Query: area?, limit?
     */
    getFloodStatus: async (req, res) => {
        try {
            const { area, limit } = req.query;
            const data = await chatRepository.getChatSensorSnapshot(
                area || null,
                limit || 50
            );

            res.json({
                success: true,
                data,
                timestamp: new Date().toISOString(),
                count: data.length
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message, data: [] });
        }
    }
};

module.exports = chatController;
