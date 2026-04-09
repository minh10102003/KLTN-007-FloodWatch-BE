const { Resend } = require('resend');

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

    await resend.emails.send({
        from: process.env.OTP_FROM_EMAIL,
        to: [email],
        subject,
        text
    });
    return { channel: 'email', ok: true };
}

async function sendWebhook(payload) {
    const url = String(process.env.EMERGENCY_WEBHOOK_URL || '').trim();
    if (!url) return { channel: 'webhook', ok: false, reason: 'EMERGENCY_WEBHOOK_URL missing' };

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
    if (!rsp.ok) {
        const body = await rsp.text().catch(() => '');
        return { channel: 'webhook', ok: false, reason: `HTTP ${rsp.status} ${body}`.slice(0, 300) };
    }
    return { channel: 'webhook', ok: true };
}

async function sendTelegram(payload) {
    const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
    const chatId = String(process.env.TELEGRAM_CHAT_ID || '').trim();
    if (!token || !chatId) {
        return { channel: 'telegram', ok: false, reason: 'TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID missing' };
    }
    const text = buildAlertMessage(payload);
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const rsp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text })
    });
    if (!rsp.ok) {
        const body = await rsp.text().catch(() => '');
        return { channel: 'telegram', ok: false, reason: `HTTP ${rsp.status} ${body}`.slice(0, 300) };
    }
    return { channel: 'telegram', ok: true };
}

const emergencyNotificationService = {
    async notifySubscriber(subscriber, payload) {
        const methods = normalizeMethods(subscriber.notification_methods);
        const tasks = [];

        if (methods.includes('email')) tasks.push(sendEmail(subscriber.email, payload));
        if (methods.includes('webhook')) tasks.push(sendWebhook({ ...payload, subscriber_user_id: subscriber.user_id }));
        if (methods.includes('telegram')) tasks.push(sendTelegram(payload));

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
