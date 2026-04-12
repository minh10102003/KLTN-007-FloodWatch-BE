const telegramWebhookService = require('../services/telegramWebhookService');

const telegramController = {
    /**
     * Webhook Telegram — không dùng JWT; bảo vệ bằng header X-Telegram-Bot-Api-Secret-Token (setWebhook secret_token).
     */
    webhook: async (req, res) => {
        const expected = String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
        if (expected) {
            const got = String(req.get('X-Telegram-Bot-Api-Secret-Token') || '').trim();
            if (got !== expected) {
                return res.status(403).json({ ok: false });
            }
        }

        try {
            await telegramWebhookService.handleUpdate(req.body || {});
            return res.json({ ok: true });
        } catch (err) {
            console.error('❌ [Telegram webhook]', err.message);
            return res.json({ ok: true });
        }
    }
};

module.exports = telegramController;
