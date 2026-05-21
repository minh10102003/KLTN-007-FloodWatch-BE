const chatRepository = require('../repositories/chatRepository');
const geminiChatService = require('../services/geminiChatService');
const chatAgentService = require('../services/chatAgentService');
const { submitCrowdReport } = require('../services/crowdReportSubmitService');

const chatController = {
    /**
     * POST /api/chat
     * Body: { message, history?, account_id?, area? }
     * Trả meta.report_draft khi AI nhận diện yêu cầu tạo báo cáo (Hướng B).
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

            const intentAnalysis = await chatAgentService.analyzeReportIntent(msg);
            let reportDraft = null;
            if (intentAnalysis.intent === 'create_report') {
                reportDraft = await chatAgentService.buildReportDraft(intentAnalysis);
            }
            const agentContextBlock = chatAgentService.buildAgentContextBlock(reportDraft);

            const sensorSnapshot = await chatRepository.getChatSensorSnapshot(area || null);
            const { reply, model, sensor_count, report_draft } = await geminiChatService.sendChatMessage(
                msg,
                history,
                sensorSnapshot,
                { agentContextBlock, reportDraft }
            );

            res.json({
                success: true,
                reply,
                timestamp: new Date().toISOString(),
                meta: {
                    model,
                    sensor_count,
                    account_id: accountId ? String(accountId).slice(0, 64) : undefined,
                    intent: intentAnalysis.intent,
                    report_draft: report_draft || reportDraft || undefined
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
            const status =
                err.status === 429 || /quota|rate/i.test(String(err.message)) ? 429 : 502;
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
     * POST /api/chat/confirm-report
     * Gửi báo cáo sau khi user xác nhận bản nháp từ chat (cùng rule POST /api/report-flood).
     */
    confirmReport: async (req, res) => {
        try {
            const body = req.body || {};
            const result = await submitCrowdReport({ user: req.user || null, body });
            res.json({
                success: true,
                message: result.message,
                reply: `✅ ${result.message} Mã báo cáo: #${result.data.id}. Trạng thái: ${result.data.validation_status}.`,
                data: result.data,
                timestamp: new Date().toISOString()
            });
        } catch (err) {
            if (err.code === 'VALIDATION') {
                return res.status(400).json({ success: false, error: err.message, reply: null });
            }
            if (err.code === 'NO_SENSOR_IN_RADIUS') {
                return res.status(400).json({
                    success: false,
                    error: 'Hiện tại khu vực chưa có máy đo, không thể xác thực',
                    reply: null
                });
            }
            console.error('[chat] confirm-report:', err.message);
            res.status(500).json({ success: false, error: err.message, reply: null });
        }
    },

    /**
     * GET /api/flood-status
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
