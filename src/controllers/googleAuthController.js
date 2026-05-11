const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const userModel = require('../models/userModel');

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_SCOPES = ['openid', 'email', 'profile'].join(' ');

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

function createOauthState() {
    return jwt.sign(
        { typ: 'google_oauth', n: crypto.randomBytes(16).toString('hex') },
        getStateSecret(),
        { expiresIn: '10m' }
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
            const state = createOauthState();
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
            res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
        } catch (err) {
            console.error('[GoogleOAuth] start:', err.message);
            return res.status(500).json({ success: false, error: err.message || 'Lỗi khởi tạo OAuth' });
        }
    },

    /**
     * Callback từ Google: đổi code → id_token, tìm/tạo user, phát JWT giống login thường, redirect FE kèm token trong hash.
     */
    callback: async (req, res) => {
        const errBase = getErrorRedirectBase();
        try {
            const { code, state, error: googleError, error_description: googleDesc } = req.query;

            if (googleError) {
                const msg = String(googleDesc || googleError).slice(0, 300);
                return redirectWithHash(res, errBase, {
                    oauth_error: 'google',
                    message: msg
                });
            }

            if (!code) {
                return redirectWithHash(res, errBase, {
                    oauth_error: 'google',
                    message: 'Thiếu mã authorization (code)'
                });
            }

            verifyOauthState(state);

            const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
            const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
            if (!clientId || !clientSecret) {
                return redirectWithHash(res, errBase, {
                    oauth_error: 'google',
                    message: 'Server chưa cấu hình Google OAuth'
                });
            }

            const redirectUri = getRedirectUri();
            const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
            const { tokens } = await oAuth2Client.getToken(String(code));
            if (!tokens.id_token) {
                return redirectWithHash(res, errBase, {
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
                return redirectWithHash(res, errBase, {
                    oauth_error: 'google',
                    message: 'Tài khoản Google không có email công khai'
                });
            }
            if (!emailVerified) {
                return redirectWithHash(res, errBase, {
                    oauth_error: 'google',
                    message: 'Email Google chưa được xác minh'
                });
            }

            const result = await userModel.loginOrRegisterWithGoogle({
                sub: String(sub),
                email: String(email),
                name: String(name || '')
            });

            const okBase = getSuccessRedirectBase();
            redirectWithHash(res, okBase, {
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
            const msg = err.name === 'JsonWebTokenError' ? 'Phiên OAuth không hợp lệ hoặc đã hết hạn' : err.message || 'Lỗi đăng nhập Google';
            return redirectWithHash(res, errBase, {
                oauth_error: 'google',
                message: String(msg).slice(0, 500)
            });
        }
    }
};

module.exports = googleAuthController;
