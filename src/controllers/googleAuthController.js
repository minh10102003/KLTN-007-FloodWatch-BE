const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const userModel = require('../models/userModel');

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_SCOPES = ['openid', 'email', 'profile'].join(' ');
const OAUTH_STATE_EXPIRES = '10m';
const PLATFORM_WEB = 'web';
const PLATFORM_MOBILE = 'mobile';

function getStateSecret() {
    return String(process.env.GOOGLE_OAUTH_STATE_SECRET || process.env.JWT_SECRET || '').trim() || 'change-me-google-oauth-state';
}

function getRedirectUri() {
    const u = String(process.env.GOOGLE_REDIRECT_URI || '').trim();
    if (u) return u;
    return 'https://api.floodsight.id.vn/api/v1/auth/google/callback';
}

function getSuccessRedirectBase() {
    return String(process.env.GOOGLE_OAUTH_SUCCESS_REDIRECT || 'https://floodsight.id.vn/login').trim();
}

function getErrorRedirectBase() {
    return String(process.env.GOOGLE_OAUTH_ERROR_REDIRECT || process.env.GOOGLE_OAUTH_SUCCESS_REDIRECT || 'https://floodsight.id.vn/login').trim();
}

function parseCsv(raw) {
    if (!raw || typeof raw !== 'string') return [];
    return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

function inferPlatform(raw) {
    const value = String(raw || '').trim().toLowerCase();
    return value === PLATFORM_MOBILE ? PLATFORM_MOBILE : PLATFORM_WEB;
}

function getDefaultRedirectByPlatform(platform, kind) {
    const isMobile = platform === PLATFORM_MOBILE;
    const legacySuccess = getSuccessRedirectBase();
    const legacyError = getErrorRedirectBase();

    if (kind === 'success') {
        if (isMobile) {
            return String(process.env.GOOGLE_OAUTH_SUCCESS_REDIRECT_MOBILE || legacySuccess).trim();
        }
        return String(process.env.GOOGLE_OAUTH_SUCCESS_REDIRECT_WEB || legacySuccess).trim();
    }

    if (isMobile) {
        return String(process.env.GOOGLE_OAUTH_ERROR_REDIRECT_MOBILE || legacyError).trim();
    }
    return String(process.env.GOOGLE_OAUTH_ERROR_REDIRECT_WEB || legacyError).trim();
}

function getAllowedRedirectSet() {
    const defaults = [
        'https://floodsight.id.vn/login',
        'floodsight://google-auth-callback',
        String(process.env.GOOGLE_OAUTH_SUCCESS_REDIRECT_WEB || '').trim(),
        String(process.env.GOOGLE_OAUTH_ERROR_REDIRECT_WEB || '').trim(),
        String(process.env.GOOGLE_OAUTH_SUCCESS_REDIRECT_MOBILE || '').trim(),
        String(process.env.GOOGLE_OAUTH_ERROR_REDIRECT_MOBILE || '').trim(),
        String(process.env.EXPO_PUBLIC_GOOGLE_MOBILE_REDIRECT_URI || '').trim(),
        ...parseCsv(process.env.GOOGLE_OAUTH_ALLOWED_REDIRECT_URIS)
    ].filter(Boolean);
    return new Set(defaults);
}

function isRedirectUriAllowed(uri) {
    const candidate = String(uri || '').trim();
    if (!candidate) return false;
    return getAllowedRedirectSet().has(candidate);
}

function resolveRequestedRedirectUri({ requestedRedirectUri, platform, kind }) {
    const requested = String(requestedRedirectUri || '').trim();
    if (requested) {
        if (!isRedirectUriAllowed(requested)) {
            const err = new Error('redirect_uri không nằm trong whitelist an toàn');
            err.code = 'INVALID_REDIRECT_URI';
            throw err;
        }
        return requested;
    }
    return getDefaultRedirectByPlatform(platform, kind);
}

function createOauthState(statePayload) {
    return jwt.sign(
        {
            typ: 'google_oauth',
            n: crypto.randomBytes(16).toString('hex'),
            sid: crypto.randomUUID(),
            ...statePayload
        },
        getStateSecret(),
        { expiresIn: OAUTH_STATE_EXPIRES }
    );
}

function verifyOauthState(state) {
    if (!state || typeof state !== 'string') {
        throw new Error('Thiếu state OAuth');
    }
    const decoded = jwt.verify(state, getStateSecret());
    if (decoded.typ !== 'google_oauth') {
        throw new Error('State OAuth không hợp lệ');
    }
    return decoded;
}

function redirectWithHash(res, baseUrl, hashParams) {
    const base = baseUrl.split('#')[0];
    const h = Object.entries(hashParams)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v ?? ''))}`)
        .join('&');
    res.redirect(`${base}#${h}`);
}

function redirectWithQuery(res, baseUrl, queryParams) {
    const base = baseUrl.split('#')[0];
    const u = new URL(base);
    for (const [k, v] of Object.entries(queryParams)) {
        if (v == null) continue;
        u.searchParams.set(k, String(v));
    }
    res.redirect(u.toString());
}

function maskToken(value) {
    const s = String(value || '');
    if (!s) return '';
    if (s.length <= 10) return '***';
    return `${s.slice(0, 6)}...${s.slice(-4)}`;
}

function logOAuthDebug(stage, context = {}) {
    const safe = {
        ...context,
        access_token: context.access_token ? maskToken(context.access_token) : undefined,
        refresh_token: context.refresh_token ? maskToken(context.refresh_token) : undefined,
        session_token: context.session_token ? maskToken(context.session_token) : undefined,
        token: context.token ? maskToken(context.token) : undefined
    };
    console.log(`[GoogleOAuth] ${stage}`, safe);
}

function redirectByPlatform(res, platform, baseUrl, params) {
    if (platform === PLATFORM_MOBILE) {
        return redirectWithQuery(res, baseUrl, params);
    }
    return redirectWithQuery(res, baseUrl, params);
}

const googleAuthController = {
    /**
     * Bắt đầu đăng nhập Google — redirect sang Google (client_secret chỉ dùng ở callback).
     */
    start: (req, res) => {
        try {
            const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
            if (!clientId) {
                return res.status(503).json({
                    success: false,
                    error: 'Chưa cấu hình GOOGLE_CLIENT_ID trên server'
                });
            }
            const platform = inferPlatform(req.query.platform);
            const requestedRedirectUri = String(req.query.redirect_uri || '').trim();
            const successRedirectUri = resolveRequestedRedirectUri({
                requestedRedirectUri,
                platform,
                kind: 'success'
            });
            const errorRedirectUri = resolveRequestedRedirectUri({
                requestedRedirectUri,
                platform,
                kind: 'error'
            });
            const state = createOauthState({
                p: platform,
                rr: requestedRedirectUri || null,
                sr: successRedirectUri,
                er: errorRedirectUri
            });
            const redirectUri = getRedirectUri();
            const params = new URLSearchParams({
                client_id: clientId,
                redirect_uri: redirectUri,
                response_type: 'code',
                scope: GOOGLE_SCOPES,
                state,
                access_type: 'offline',
                prompt: 'consent'
            });
            logOAuthDebug('start', {
                platform,
                requested_redirect_uri: requestedRedirectUri || null,
                resolved_redirect_uri: successRedirectUri,
                state_id: jwt.decode(state)?.sid || null
            });
            res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
        } catch (err) {
            if (err.code === 'INVALID_REDIRECT_URI') {
                return res.status(400).json({ success: false, error: err.message });
            }
            console.error('[GoogleOAuth] start:', err.message);
            return res.status(500).json({ success: false, error: err.message || 'Lỗi khởi tạo OAuth' });
        }
    },

    /**
     * Callback từ Google: đổi code → id_token, tìm/tạo user, phát JWT giống login thường, redirect FE kèm token trong hash.
     */
    callback: async (req, res) => {
        const fallbackPlatform = inferPlatform(req.query.platform);
        let platform = fallbackPlatform;
        let successBase = getDefaultRedirectByPlatform(platform, 'success');
        let errBase = getDefaultRedirectByPlatform(platform, 'error');
        let stateId = null;
        let requestedRedirectUri = null;
        try {
            const { code, state, error: googleError, error_description: googleDesc } = req.query;

            const decodedState = verifyOauthState(state);
            stateId = decodedState.sid || null;
            platform = inferPlatform(decodedState.p);
            requestedRedirectUri = decodedState.rr || null;
            successBase = resolveRequestedRedirectUri({
                requestedRedirectUri: decodedState.rr || decodedState.sr,
                platform,
                kind: 'success'
            });
            errBase = resolveRequestedRedirectUri({
                requestedRedirectUri: decodedState.rr || decodedState.er,
                platform,
                kind: 'error'
            });

            if (googleError) {
                const msg = String(googleDesc || googleError).slice(0, 300);
                logOAuthDebug('callback_google_error', {
                    platform,
                    requested_redirect_uri: requestedRedirectUri,
                    resolved_redirect_uri: errBase,
                    state_id: stateId,
                    error: msg
                });
                return redirectByPlatform(res, platform, errBase, {
                    oauth_error: 'google',
                    message: msg
                });
            }

            if (!code) {
                return redirectByPlatform(res, platform, errBase, {
                    oauth_error: 'google',
                    message: 'Thiếu mã authorization (code)'
                });
            }

            const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
            const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
            if (!clientId || !clientSecret) {
                return redirectByPlatform(res, platform, errBase, {
                    oauth_error: 'google',
                    message: 'Server chưa cấu hình Google OAuth'
                });
            }

            const redirectUri = getRedirectUri();
            const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
            const { tokens } = await oAuth2Client.getToken(String(code));
            if (!tokens.id_token) {
                return redirectByPlatform(res, platform, errBase, {
                    oauth_error: 'google',
                    message: 'Google không trả id_token'
                });
            }

            const ticket = await oAuth2Client.verifyIdToken({
                idToken: tokens.id_token,
                audience: clientId
            });
            const payload = ticket.getPayload();
            const email = payload.email;
            const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
            const sub = payload.sub;
            const name = payload.name || '';

            if (!email) {
                return redirectByPlatform(res, platform, errBase, {
                    oauth_error: 'google',
                    message: 'Tài khoản Google không có email công khai'
                });
            }
            if (!emailVerified) {
                return redirectByPlatform(res, platform, errBase, {
                    oauth_error: 'google',
                    message: 'Email Google chưa được xác minh'
                });
            }

            const result = await userModel.loginOrRegisterWithGoogle({
                sub: String(sub),
                email: String(email),
                name: String(name || '')
            });

            logOAuthDebug('callback_success', {
                platform,
                requested_redirect_uri: requestedRedirectUri,
                resolved_redirect_uri: successBase,
                state_id: stateId,
                access_token: result.access_token,
                refresh_token: result.refresh_token,
                session_token: result.session_token
            });
            redirectByPlatform(res, platform, successBase, {
                oauth: 'google',
                access_token: result.access_token,
                refresh_token: result.refresh_token,
                session_token: result.session_token,
                expires_in: String(result.expires_in),
                token: result.token,
                refresh_expires_at: result.refresh_expires_at || ''
            });
        } catch (err) {
            console.error('[GoogleOAuth] callback:', err.message);
            const msg = err.name === 'JsonWebTokenError'
                ? 'Phiên OAuth không hợp lệ hoặc đã hết hạn'
                : err.message || 'Lỗi đăng nhập Google';
            logOAuthDebug('callback_failed', {
                platform,
                requested_redirect_uri: requestedRedirectUri,
                resolved_redirect_uri: errBase,
                state_id: stateId,
                error: msg
            });
            return redirectByPlatform(res, platform, errBase, {
                oauth_error: 'google',
                message: String(msg).slice(0, 500)
            });
        }
    }
};

module.exports = googleAuthController;
