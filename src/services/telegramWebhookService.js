const userRepository = require('../repositories/userRepository');
const telegramLinkRepository = require('../repositories/telegramLinkRepository');

async function sendTelegramChatMessage(chatId, text) {
    const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
    if (!token || !chatId) return;
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: String(chatId), text: String(text).slice(0, 3500) })
    });
}

/**
 * Xử lý Update từ Telegram Bot webhook (JSON body).
 */
async function handleUpdate(update) {
    const msg = update.message;
    if (!msg || msg.chat?.type !== 'private') {
        return { handled: false, reason: 'not_private_message' };
    }

    const text = String(msg.text || '').trim();
    if (!text.startsWith('/start')) {
        return { handled: false, reason: 'no_start' };
    }

    const parts = text.split(/\s+/);
    const linkToken = parts.length > 1 ? parts[1].trim() : '';
    const chatId = msg.chat.id;
    const tgUsername = msg.from?.username || null;

    if (!linkToken) {
        await sendTelegramChatMessage(
            chatId,
            'Hay lien ket tai khoan FloodWatch tren ung dung web: mo nut "Lien ket Telegram" va mo link.'
        );
        return { handled: true, reason: 'start_without_token' };
    }

    const userId = await telegramLinkRepository.peekValidToken(linkToken);
    if (!userId) {
        await sendTelegramChatMessage(
            chatId,
            'Ma lien ket khong hop le hoac da het han. Vui long tao ma moi tren ung dung.'
        );
        return { handled: true, reason: 'invalid_or_expired_token' };
    }

    const existing = await userRepository.findByTelegramChatId(String(chatId));
    if (existing && Number(existing.id) !== Number(userId)) {
        await sendTelegramChatMessage(
            chatId,
            'Telegram nay da lien ket voi tai khoan khac tren he thong. Lien he admin neu can ho tro.'
        );
        return { handled: true, reason: 'chat_id_taken' };
    }

    try {
        await userRepository.setTelegramChat(userId, String(chatId), tgUsername);
        await telegramLinkRepository.markConsumed(linkToken);
        await sendTelegramChatMessage(
            chatId,
            'Da lien ket thanh cong! Ban se nhan canh bao ngap (neu da dang ky vung va bat kenh Telegram).'
        );
        return { handled: true, reason: 'linked_ok' };
    } catch (err) {
        if (err.code === '23505') {
            await sendTelegramChatMessage(chatId, 'Loi trung Telegram voi tai khoan khac. Vui long lien he admin.');
            return { handled: true, reason: 'unique_violation' };
        }
        throw err;
    }
}

module.exports = {
    handleUpdate,
    sendTelegramChatMessage
};
