/**
 * Kiểm thử chức năng 1.3 — Cảnh báo tự động qua Telegram (Telegram Alerts).
 *
 * Nghiệp vụ: water_level vượt ngưỡng → tra cứu danh sách subscriber của trạm
 *           → gửi tin nhắn Telegram cho từng user.
 *
 * Cách test (không gọi Telegram thật):
 *   - Mock global `fetch` để bắt request POST tới api.telegram.org/sendMessage.
 *   - Đẩy giá trị mực nước cao hơn ngưỡng → kiểm tra:
 *       (1) buildAlertMessage trả nội dung chứa "danger" và mức nước.
 *       (2) notifySubscriber gọi đúng số request Telegram = số subscriber có chat_id.
 *       (3) Người dùng không bật method "telegram" sẽ KHÔNG nhận tin.
 */
const path = require('path');

const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_ENV = { ...process.env };

function loadFreshNotificationService() {
    const modPath = require.resolve('../src/services/emergencyNotificationService');
    delete require.cache[modPath];
    return require('../src/services/emergencyNotificationService');
}

describe('Telegram Alerts — gửi tin khi mực nước > ngưỡng', () => {
    beforeEach(() => {
        process.env = { ...ORIGINAL_ENV };
        process.env.TELEGRAM_BOT_TOKEN = 'test-token';
        process.env.EMERGENCY_NOTIFY_MAX_RETRIES = '1';
        process.env.EMERGENCY_NOTIFY_RETRY_BASE_MS = '10';

        global.fetch = jest.fn(async () => ({
            ok: true,
            status: 200,
            text: async () => 'ok',
        }));
    });

    afterEach(() => {
        global.fetch = ORIGINAL_FETCH;
        process.env = { ...ORIGINAL_ENV };
        jest.restoreAllMocks();
    });

    test('buildAlertMessage chứa status DANGER và mực nước (cm) — đầu vào ngập nặng', () => {
        const { buildAlertMessage } = loadFreshNotificationService();
        const text = buildAlertMessage({
            sensorId: 'S01',
            locationName: 'Trạm đo Nguyễn Hữu Cảnh',
            status: 'danger',
            waterLevel: 42.7,
            velocity: 3.5,
        });
        expect(text).toMatch(/DANGER/);
        expect(text).toContain('42.7');
        expect(text).toContain('3.50');
        expect(text).toContain('Trạm đo Nguyễn Hữu Cảnh');
    });

    test('notifySubscriber gọi Telegram đúng 1 lần với chat_id của user (water_level > danger)', async () => {
        const svc = loadFreshNotificationService();
        const subscriber = {
            user_id: 7,
            notification_methods: ['telegram'],
            telegram_chat_id: '999111222',
        };
        const payload = {
            sensorId: 'S01',
            locationName: 'Trạm S01',
            status: 'danger',
            waterLevel: 55, // > danger 30
            velocity: 4.2,
        };

        const results = await svc.notifySubscriber(subscriber, payload);

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toBe('https://api.telegram.org/bottest-token/sendMessage');
        const body = JSON.parse(options.body);
        expect(body.chat_id).toBe('999111222');
        expect(body.text).toMatch(/DANGER/);
        expect(body.text).toContain('55.0');

        expect(results).toHaveLength(1);
        expect(results[0]).toEqual(
            expect.objectContaining({ channel: 'telegram', ok: true }),
        );
    });

    test('notifySubscriber(..., { channels: ["telegram"] }) chỉ gửi Telegram (bỏ email/webhook)', async () => {
        process.env.RESEND_API_KEY = 're_test';
        process.env.OTP_FROM_EMAIL = 'noreply@test.com';
        const svc = loadFreshNotificationService();
        const subscriber = {
            user_id: 9,
            notification_methods: ['email', 'telegram'],
            email: 'u@test.com',
            telegram_chat_id: '777',
        };
        const payload = {
            sensorId: 'S01',
            status: 'danger',
            waterLevel: 40,
            velocity: 1,
        };

        const results = await svc.notifySubscriber(subscriber, payload, { channels: ['telegram'] });

        const telegramCalls = global.fetch.mock.calls.filter(([u]) =>
            String(u).includes('api.telegram.org'),
        );
        expect(telegramCalls).toHaveLength(1);
        expect(results).toHaveLength(1);
        expect(results[0]).toEqual(expect.objectContaining({ channel: 'telegram', ok: true }));
    });

    test('Subscriber KHÔNG bật method "telegram" → không gọi Telegram API', async () => {
        const svc = loadFreshNotificationService();
        const subscriber = {
            user_id: 8,
            notification_methods: ['email'], // chỉ email
            telegram_chat_id: '111',
            email: '',
        };
        const payload = {
            sensorId: 'S01',
            status: 'danger',
            waterLevel: 55,
            velocity: 4.2,
        };

        await svc.notifySubscriber(subscriber, payload);
        const telegramCalls = global.fetch.mock.calls.filter(([u]) =>
            String(u).includes('api.telegram.org'),
        );
        expect(telegramCalls).toHaveLength(0);
    });

    test('Nhiều subscriber có telegram_chat_id → mỗi user nhận đúng 1 request riêng', async () => {
        const svc = loadFreshNotificationService();
        const subscribers = [
            { user_id: 1, notification_methods: ['telegram'], telegram_chat_id: 'A' },
            { user_id: 2, notification_methods: ['telegram'], telegram_chat_id: 'B' },
            { user_id: 3, notification_methods: ['telegram'], telegram_chat_id: 'C' },
        ];
        const payload = { sensorId: 'S01', status: 'danger', waterLevel: 60, velocity: 5 };

        for (const s of subscribers) {
            // eslint-disable-next-line no-await-in-loop
            await svc.notifySubscriber(s, payload);
        }

        const sentChatIds = global.fetch.mock.calls
            .filter(([u]) => String(u).includes('api.telegram.org'))
            .map(([, opt]) => JSON.parse(opt.body).chat_id);
        expect(sentChatIds.sort()).toEqual(['A', 'B', 'C']);
    });

    test('Thiếu TELEGRAM_BOT_TOKEN → trả lỗi rõ ràng, không gọi fetch', async () => {
        delete process.env.TELEGRAM_BOT_TOKEN;
        const svc = loadFreshNotificationService();
        const subscriber = {
            user_id: 1,
            notification_methods: ['telegram'],
            telegram_chat_id: 'A',
        };
        const results = await svc.notifySubscriber(subscriber, {
            sensorId: 'S01',
            status: 'danger',
            waterLevel: 99,
            velocity: 1,
        });
        expect(global.fetch).not.toHaveBeenCalled();
        expect(results[0]).toEqual(
            expect.objectContaining({
                channel: 'telegram',
                ok: false,
                reason: expect.stringMatching(/TOKEN/i),
            }),
        );
    });
});
