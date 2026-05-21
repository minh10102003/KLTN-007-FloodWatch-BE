const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GEMINI_AGENT_INTENT_PROMPT } = require('../config/geminiAgentPrompt');
const { mapFloodLevel, VALID_LEVELS } = require('../utils/floodLevelMapper');
const googlePlacesGeocodeService = require('./googlePlacesGeocodeService');
const geminiChatService = require('./geminiChatService');

const CREATE_REPORT_KEYWORDS =
    /\b(tạo|tao|lập|lap|gửi|gui|đăng|dang|báo cáo|bao cao|báo cáo giúp|report)\b.*\b(ngập|ngap|lụt|lut|báo cáo|bao cao)\b|\b(báo cáo|bao cao)\b.*\b(cho|tại|tai|ở|o|khu|đường|duong|quận|quan)\b/i;

function heuristicCreateReport(message) {
    return CREATE_REPORT_KEYWORDS.test(String(message || ''));
}

function parseIntentJson(text) {
    const raw = String(text || '').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const slice = jsonMatch ? jsonMatch[0] : raw;
    try {
        return JSON.parse(slice);
    } catch {
        return null;
    }
}

function normalizeIntentPayload(obj, userMessage) {
    const intent =
        obj?.intent === 'create_report' || heuristicCreateReport(userMessage)
            ? 'create_report'
            : 'general';

    const location_text =
        obj?.location_text != null && String(obj.location_text).trim()
            ? String(obj.location_text).trim().slice(0, 256)
            : null;

    let flood_level = mapFloodLevel(obj?.flood_level);
    if (!flood_level && userMessage) {
        flood_level = mapFloodLevel(userMessage);
    }

    const content =
        obj?.content != null && String(obj.content).trim()
            ? String(obj.content).trim().slice(0, 500)
            : null;

    const missing = Array.isArray(obj?.missing_fields) ? obj.missing_fields.map(String) : [];
    const missing_fields = [];
    if (intent === 'create_report') {
        if (!location_text) missing_fields.push('location_text');
        if (!flood_level) missing_fields.push('flood_level');
        for (const m of missing) {
            if (m && !missing_fields.includes(m)) missing_fields.push(m);
        }
    }

    return {
        intent,
        location_text,
        flood_level,
        content,
        missing_fields
    };
}

/**
 * Phân tích intent (Gemini JSON + heuristic fallback).
 */
async function analyzeReportIntent(userMessage) {
    const msg = String(userMessage || '').trim();
    if (!msg) {
        return { intent: 'general', location_text: null, flood_level: null, content: null, missing_fields: [] };
    }

    if (!geminiChatService.getApiKey()) {
        if (heuristicCreateReport(msg)) {
            return normalizeIntentPayload({ intent: 'create_report' }, msg);
        }
        return { intent: 'general', location_text: null, flood_level: null, content: null, missing_fields: [] };
    }

    try {
        const genAI = new GoogleGenerativeAI(geminiChatService.getApiKey());
        const model = genAI.getGenerativeModel({
            model: geminiChatService.getModelName(),
            systemInstruction: GEMINI_AGENT_INTENT_PROMPT,
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.2
            }
        });
        const result = await model.generateContent(`Câu người dùng:\n${msg}`);
        const parsed = parseIntentJson(result.response.text());
        if (parsed) {
            return normalizeIntentPayload(parsed, msg);
        }
    } catch (err) {
        console.warn('[chat-agent] intent extraction failed:', err.message);
    }

    if (heuristicCreateReport(msg)) {
        return normalizeIntentPayload({ intent: 'create_report' }, msg);
    }
    return { intent: 'general', location_text: null, flood_level: null, content: null, missing_fields: [] };
}

/**
 * Geocode địa chỉ → lat/lng (Google).
 */
async function resolveLocation(locationText) {
    const address = String(locationText || '').trim();
    if (address.length < 3) {
        return { ok: false, error: 'Địa chỉ quá ngắn', lat: null, lng: null, formatted_address: null };
    }

    try {
        if (!googlePlacesGeocodeService.getApiKey()) {
            return {
                ok: false,
                error: 'Server chưa cấu hình geocode (GOOGLE_PLACES_API_KEY)',
                lat: null,
                lng: null,
                formatted_address: null
            };
        }

        const data = await googlePlacesGeocodeService.geocodeForward(
            address.includes('TP.HCM') || address.includes('Hồ Chí Minh')
                ? address
                : `${address}, TP. Hồ Chí Minh, Vietnam`
        );

        if (data.status !== 'OK' || !data.results?.length) {
            return {
                ok: false,
                error: 'Không tìm thấy tọa độ cho địa chỉ này',
                lat: null,
                lng: null,
                formatted_address: null
            };
        }

        const best = data.results[0];
        const loc = best.geometry?.location;
        if (loc?.lat == null || loc?.lng == null) {
            return { ok: false, error: 'Google không trả tọa độ', lat: null, lng: null, formatted_address: null };
        }

        return {
            ok: true,
            error: null,
            lat: Number(loc.lat),
            lng: Number(loc.lng),
            formatted_address: best.formatted_address || address,
            place_id: best.place_id || null
        };
    } catch (err) {
        return {
            ok: false,
            error: err.message || 'Lỗi geocode',
            lat: null,
            lng: null,
            formatted_address: null
        };
    }
}

/**
 * Xây bản nháp báo cáo (chưa ghi DB).
 */
async function buildReportDraft(intentAnalysis) {
    if (intentAnalysis.intent !== 'create_report') {
        return null;
    }

    const draft = {
        ready: false,
        intent: 'create_report',
        level: intentAnalysis.flood_level,
        lat: null,
        lng: null,
        location_description: intentAnalysis.location_text,
        formatted_address: null,
        content: intentAnalysis.content,
        missing_fields: [...intentAnalysis.missing_fields],
        geocode_ok: false,
        geocode_error: null,
        confirm_action: 'POST /api/chat/confirm-report'
    };

    if (draft.missing_fields.includes('location_text') || !draft.location_description) {
        draft.missing_fields = [...new Set([...draft.missing_fields, 'location_text'])];
        return draft;
    }

    if (draft.missing_fields.includes('flood_level') || !draft.level) {
        draft.missing_fields = [...new Set([...draft.missing_fields, 'flood_level'])];
        return draft;
    }

    if (!VALID_LEVELS.includes(draft.level)) {
        draft.missing_fields.push('flood_level');
        return draft;
    }

    const geo = await resolveLocation(draft.location_description);
    if (!geo.ok) {
        draft.geocode_error = geo.error;
        draft.missing_fields = [...new Set([...draft.missing_fields, 'geocode'])];
        return draft;
    }

    draft.lat = geo.lat;
    draft.lng = geo.lng;
    draft.formatted_address = geo.formatted_address;
    draft.geocode_ok = true;
    draft.missing_fields = draft.missing_fields.filter(
        (f) => f !== 'location_text' && f !== 'flood_level' && f !== 'geocode'
    );
    draft.ready = draft.missing_fields.length === 0;
    return draft;
}

function buildAgentContextBlock(reportDraft) {
    if (!reportDraft || reportDraft.intent !== 'create_report') return '';

    if (reportDraft.ready) {
        return `

## Bản nháp báo cáo (Hướng B — chưa gửi DB)
Người dùng muốn tạo báo cáo ngập. Hệ thống đã soạn nháp:
- Địa điểm: ${reportDraft.formatted_address || reportDraft.location_description}
- Mức ngập: ${reportDraft.level}
- Tọa độ: ${reportDraft.lat}, ${reportDraft.lng}
${reportDraft.content ? `- Mô tả: ${reportDraft.content}` : ''}

Trong câu trả lời: tóm tắt nháp, nhắc bấm **Xác nhận gửi báo cáo** trên app (gọi API confirm). KHÔNG nói "đã gửi báo cáo thành công" — chưa gửi cho đến khi user xác nhận.`;
    }

    const missing = (reportDraft.missing_fields || []).join(', ');
    return `

## Yêu cầu tạo báo cáo (chưa đủ dữ liệu)
Thiếu: ${missing || 'thông tin'}.
${reportDraft.geocode_error ? `Lỗi địa chỉ: ${reportDraft.geocode_error}.` : ''}
Hỏi user bổ sung (địa chỉ cụ thể TP.HCM, mức: Nhẹ / Trung bình / Nặng). Không bịa tọa độ.`;
}

module.exports = {
    analyzeReportIntent,
    buildReportDraft,
    buildAgentContextBlock,
    resolveLocation
};
