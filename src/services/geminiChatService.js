const { GoogleGenerativeAI } = require('@google/generative-ai');
const { buildSystemPrompt } = require('../config/geminiChatPrompt');
const { buildChatContext } = require('../utils/chatContextBuilder');

const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY_TURNS = 20;

function getApiKey() {
    return String(process.env.GEMINI_API_KEY || '').trim();
}

function getModelName() {
    return String(process.env.GEMINI_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
}

/**
 * Chuẩn hóa history từ FE → Gemini (role: user | model).
 */
function normalizeHistory(history) {
    if (!Array.isArray(history)) return [];

    const out = [];
    for (const item of history) {
        if (!item || typeof item !== 'object') continue;
        const role = item.role === 'model' || item.role === 'assistant' ? 'model' : 'user';
        const text = String(item.content ?? item.text ?? '').trim();
        if (!text) continue;
        if (text.length > MAX_MESSAGE_CHARS) continue;
        out.push({ role, parts: [{ text: text.slice(0, MAX_MESSAGE_CHARS) }] });
    }

    while (out.length && out[0].role !== 'user') {
        out.shift();
    }
    const merged = [];
    for (const turn of out) {
        const last = merged[merged.length - 1];
        if (last && last.role === turn.role) {
            last.parts[0].text += '\n' + turn.parts[0].text;
        } else {
            merged.push(turn);
        }
    }

    return merged.slice(-MAX_HISTORY_TURNS * 2);
}

function splitCurrentUserMessage(history, message) {
    const normalized = normalizeHistory(history);
    const msg = String(message || '').trim();
    if (!msg) {
        return { priorHistory: normalized, userMessage: '' };
    }

    const last = normalized[normalized.length - 1];
    if (last && last.role === 'user' && last.parts[0].text === msg) {
        return {
            priorHistory: normalized.slice(0, -1),
            userMessage: msg
        };
    }

    return { priorHistory: normalized, userMessage: msg };
}

/**
 * @param {string} message
 * @param {Array} history
 * @param {object[]} sensorSnapshot
 */
async function sendChatMessage(message, history, sensorSnapshot) {
    const apiKey = getApiKey();
    if (!apiKey) {
        const err = new Error('GEMINI_API_KEY chưa được cấu hình trên server');
        err.code = 'GEMINI_NOT_CONFIGURED';
        throw err;
    }

    const { priorHistory, userMessage } = splitCurrentUserMessage(history, message);
    if (!userMessage) {
        const err = new Error('Tin nhắn không được để trống');
        err.code = 'EMPTY_MESSAGE';
        throw err;
    }

    const chatContext = buildChatContext(sensorSnapshot);
    const systemInstruction = buildSystemPrompt(JSON.stringify(chatContext, null, 2));
    const modelName = getModelName();

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction
    });

    const chat = model.startChat({ history: priorHistory });
    const result = await chat.sendMessage(userMessage);
    const reply = result.response.text();

    return {
        reply: reply || '',
        model: modelName,
        sensor_count: sensorSnapshot.length
    };
}

module.exports = {
    sendChatMessage,
    normalizeHistory,
    splitCurrentUserMessage,
    getApiKey,
    getModelName,
    MAX_MESSAGE_CHARS,
    DEFAULT_MODEL
};
