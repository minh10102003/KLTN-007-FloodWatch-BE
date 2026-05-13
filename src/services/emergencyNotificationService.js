const { Resend } = require('resend');

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function notifyMaxRetries() {
    return Math.min(6, Math.max(1, parseInt(process.env.EMERGENCY_NOTIFY_MAX_RETRIES || '3', 10)));
}

function notifyRetryBaseMs() {
    return Math.min(5000, Math.max(100, parseInt(process.env.EMERGENCY_NOTIFY_RETRY_BASE_MS || '400', 10)));
}

function normalizeMethods(methods) {
    if (!Array.isArray(methods)) return [];
    return methods.map((m) => String(m || '').trim().toLowerCase()).filter(Boolean);
}

function buildAlertMessage({ sensorId, locationName, status, waterLevel, velocity }) {
    const level = waterLevel != null ? `${Number(waterLevel).toFixed(1)}cm` : 'N/A';
    const vel = velocity != null ? `${Number(velocity).toFixed(2)}cm/phút` : 'N/A';
    const statusText = String(status || '').toUpperCase() || 'UNKNOWN';
    return `[FloodWatch] Canh bao ${statusText} tai ${locationName || sensorId} | muc nuoc: ${level} | toc do: ${vel}`;
}

async function sendEmail(email, payload) {
    if (!process.env.RESEND_API_KEY || !process.env.OTP_FROM_EMAIL) {
        return { channel: 'email', ok: false, reason: 'RESEND_API_KEY/OTP_FROM_EMAIL missing' };
    }
    if (!email) return { channel: 'email', ok: false, reason: 'Email missing' };

    const resend = new Resend(process.env.RESEND_API_KEY);
    const subject = `[FloodWatch] Canh bao ${String(payload.status || '').toUpperCase()} - ${payload.sensorId}`;
    const text = buildAlertMessage(payload);

    const maxTries = notifyMaxRetries();
    const baseMs = notifyRetryBaseMs();
    let lastErr = 'unknown';
    for (let i = 0; i < maxTries; i++) {
        try {
            await resend.emails.send({
                from: process.env.OTP_FROM_EMAIL,
                to: [email],
                subject,
                text
            });
            return { channel: 'email', ok: true, attempts: i + 1 };
        } catch (e) {
            lastErr = e.message || String(e);
            if (i < maxTries - 1) await sleep(baseMs * (i + 1));
        }
    }
    return { channel: 'email', ok: false, reason: lastErr, attempts: maxTries };
}

async function sendWebhook(payload) {
    const url = String(process.env.EMERGENCY_WEBHOOK_URL || '').trim();
    if (!url) return { channel: 'webhook', ok: false, reason: 'EMERGENCY_WEBHOOK_URL missing' };

    const maxTries = notifyMaxRetries();
    const baseMs = notifyRetryBaseMs();
    let lastReason = 'unknown';
    for (let i = 0; i < maxTries; i++) {
        try {
            const rsp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(process.env.EMERGENCY_WEBHOOK_BEARER
                        ? { Authorization: `Bearer ${process.env.EMERGENCY_WEBHOOK_BEARER}` }
                        : {})
                },
                body: JSON.stringify(payload)
            });
            if (rsp.ok) {
                return { channel: 'webhook', ok: true, attempts: i + 1 };
            }
            const body = await rsp.text().catch(() => '');
            lastReason = `HTTP ${rsp.status} ${body}`.slice(0, 300);
        } catch (e) {
            lastReason = e.message || String(e);
        }
        if (i < maxTries - 1) await sleep(baseMs * (i + 1));
    }
    return { channel: 'webhook', ok: false, reason: lastReason, attempts: maxTries };
}

async function sendTelegram(payload, { chatId: perUserChatId } = {}) {
    const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
    const perUser = String(perUserChatId || '').trim();
    const fallback = String(process.env.TELEGRAM_CHAT_ID || '').trim();
    const chatId = perUser || fallback;
    if (!token) {
        return { channel: 'telegram', ok: false, reason: 'TELEGRAM_BOT_TOKEN missing' };
    }
    if (!chatId) {
        return {
            channel: 'telegram',
            ok: false,
            reason: 'No Telegram chat_id: user should link bot (GET deep link) or set TELEGRAM_CHAT_ID for demo'
        };
    }
    const text = buildAlertMessage(payload);
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const maxTries = notifyMaxRetries();
    const baseMs = notifyRetryBaseMs();
    let lastReason = 'unknown';
    for (let i = 0; i < maxTries; i++) {
        try {
            const rsp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text })
            });
            if (rsp.ok) {
                return { channel: 'telegram', ok: true, attempts: i + 1 };
            }
            const body = await rsp.text().catch(() => '');
            lastReason = `HTTP ${rsp.status} ${body}`.slice(0, 300);
        } catch (e) {
            lastReason = e.message || String(e);
        }
        if (i < maxTries - 1) await sleep(baseMs * (i + 1));
    }
    return { channel: 'telegram', ok: false, reason: lastReason, attempts: maxTries };
}

const emergencyNotificationService = {
    /**
     * @param {object} subscriber
     * @param {object} payload
     * @param {{ channels?: string[] }} [options] - nếu có `channels` (vd ['telegram']) chỉ gửi các kênh đó (đã giao với notification_methods của user).
     */
    async notifySubscriber(subscriber, payload, options = {}) {
        const all = normalizeMethods(subscriber.notification_methods);
        const filter = Array.isArray(options.channels) && options.channels.length > 0
            ? new Set(options.channels.map((c) => String(c || '').trim().toLowerCase()).filter(Boolean))
            : null;
        const methods = filter ? all.filter((m) => filter.has(m)) : all;
        const tasks = [];

        if (methods.includes('email')) tasks.push(sendEmail(subscriber.email, payload));
        if (methods.includes('webhook')) tasks.push(sendWebhook({ ...payload, subscriber_user_id: subscriber.user_id }));
        if (methods.includes('telegram')) {
            tasks.push(sendTelegram(payload, { chatId: subscriber.telegram_chat_id }));
        }

        if (tasks.length === 0) {
            return [{ channel: 'none', ok: false, reason: 'No supported notification method' }];
        }

        const settled = await Promise.allSettled(tasks);
        return settled.map((r) =>
            r.status === 'fulfilled' ? r.value : { channel: 'unknown', ok: false, reason: r.reason?.message || 'Unknown error' }
        );
    }
};

module.exports = emergencyNotificationService;
module.exports.buildAlertMessage = buildAlertMessage;
module.exports.normalizeMethods = normalizeMethods;
