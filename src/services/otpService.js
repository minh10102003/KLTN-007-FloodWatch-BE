const crypto = require('crypto');
const { Resend } = require('resend');
const otpRepository = require('../repositories/otpRepository');
const userRepository = require('../repositories/userRepository');

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = parseInt(process.env.OTP_TTL_MINUTES || '5', 10);
const OTP_RESEND_COOLDOWN_SECONDS = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '60', 10);
const OTP_MAX_PER_HOUR = parseInt(process.env.OTP_MAX_PER_HOUR || '5', 10);
const OTP_PURPOSE_AUTH = 'auth';

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function generateOtpCode() {
    return String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
}

function hashOtp(code) {
    return crypto.createHash('sha256').update(String(code), 'utf8').digest('hex');
}

function otpHashesEqual(storedHex, computedHex) {
    try {
        const a = Buffer.from(storedHex, 'hex');
        const b = Buffer.from(computedHex, 'hex');
        if (a.length !== b.length || a.length !== 32) return false;
        return crypto.timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

function ensureResendConfigured() {
    if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY chưa được cấu hình');
    }
    if (!process.env.OTP_FROM_EMAIL) {
        throw new Error('OTP_FROM_EMAIL chưa được cấu hình');
    }
}

async function sendOtpEmail(email, code) {
    ensureResendConfigured();
    const resend = new Resend(process.env.RESEND_API_KEY);
    const expiresText = `${OTP_TTL_MINUTES} phút`;
    const subject = 'Mã OTP xác thực tài khoản';
    const html = `
        <div style="font-family: Arial, sans-serif; line-height:1.6;">
            <h2>FloodWatch - Xác thực OTP</h2>
            <p>Mã OTP của bạn là:</p>
            <p style="font-size: 28px; letter-spacing: 4px; font-weight: 700;">${code}</p>
            <p>Mã có hiệu lực trong <b>${expiresText}</b>.</p>
            <p>Nếu bạn không thực hiện thao tác này, vui lòng bỏ qua email.</p>
        </div>
    `;

    await resend.emails.send({
        from: process.env.OTP_FROM_EMAIL,
        to: [email],
        subject,
        html
    });
}

function toPublicOtp(row) {
    return {
        id: row.id,
        email: row.email,
        expires_at: row.expires_at,
        purpose: row.purpose,
        created_at: row.created_at
    };
}

const otpService = {
    async sendOtp(email) {
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail) {
            throw new Error('Thiếu email');
        }

        const user = await userRepository.findByEmail(normalizedEmail);
        if (!user) throw new Error('Email chưa được đăng ký');
        if (!user.is_active) throw new Error('Tài khoản đã bị vô hiệu hóa');

        const lastOtp = await otpRepository.findLatestActiveByEmail(normalizedEmail, OTP_PURPOSE_AUTH);
        if (lastOtp) {
            const diffMs = Date.now() - new Date(lastOtp.created_at).getTime();
            const cooldownMs = OTP_RESEND_COOLDOWN_SECONDS * 1000;
            if (diffMs < cooldownMs) {
                const waitSec = Math.ceil((cooldownMs - diffMs) / 1000);
                throw new Error(`Vui lòng chờ ${waitSec}s trước khi gửi lại OTP`);
            }
        }

        const recentCount = await otpRepository.countRecentByEmail(normalizedEmail, OTP_PURPOSE_AUTH, 60);
        if (recentCount >= OTP_MAX_PER_HOUR) {
            throw new Error('Bạn đã gửi OTP quá số lần cho phép trong 1 giờ');
        }

        const code = generateOtpCode();
        const codeHash = hashOtp(code);
        const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

        const otp = await otpRepository.createOtp({
            user_id: user.id,
            email: normalizedEmail,
            code_hash: codeHash,
            expires_at: expiresAt,
            purpose: OTP_PURPOSE_AUTH
        });

        await sendOtpEmail(normalizedEmail, code);
        return toPublicOtp(otp);
    },

    async resendOtp(email) {
        return await this.sendOtp(email);
    },

    async verifyOtp(email, code) {
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail || !code) {
            throw new Error('Thiếu email hoặc otp_code');
        }

        const otp = await otpRepository.findLatestActiveByEmail(normalizedEmail, OTP_PURPOSE_AUTH);
        if (!otp) throw new Error('OTP không tồn tại hoặc đã được sử dụng');

        if (new Date(otp.expires_at).getTime() <= Date.now()) {
            throw new Error('OTP đã hết hạn, vui lòng gửi lại mã mới');
        }

        const incomingHash = hashOtp(code);
        if (!otpHashesEqual(otp.code_hash, incomingHash)) {
            throw new Error('OTP không chính xác');
        }

        await otpRepository.markConsumed(otp.id);
        return {
            verified: true,
            email: normalizedEmail,
            verified_at: new Date().toISOString()
        };
    }
};

module.exports = otpService;
