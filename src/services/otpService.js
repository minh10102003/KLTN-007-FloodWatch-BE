const crypto = require('crypto');
const { Resend } = require('resend');
const otpRepository = require('../repositories/otpRepository');
const userRepository = require('../repositories/userRepository');

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = parseInt(process.env.OTP_TTL_MINUTES || '5', 10);
const OTP_RESEND_COOLDOWN_SECONDS = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '60', 10);
const OTP_MAX_PER_HOUR = parseInt(process.env.OTP_MAX_PER_HOUR || '5', 10);
const OTP_PURPOSE_AUTH = 'auth';
const OTP_PURPOSE_REGISTRATION = 'registration';
const OTP_PURPOSE_PASSWORD_RESET = 'password_reset';

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
    if (!String(process.env.RESEND_OTP_TEMPLATE_ID || '').trim()) {
        throw new Error('RESEND_OTP_TEMPLATE_ID chưa được cấu hình');
    }
}

/** Lấy địa chỉ email thô từ OTP_FROM_EMAIL (hỗ trợ dạng "Tên <a@b.com>"). */
function parseFromEmailAddress() {
    const raw = String(process.env.OTP_FROM_EMAIL || '');
    const m = raw.match(/<([^>]+)>/);
    return (m ? m[1] : raw).trim();
}

/**
 * Gửi OTP qua template Resend đã Publish. HTML mẫu: templates/resend-otp.html
 */
async function sendOtpEmail(email, code, purpose = OTP_PURPOSE_AUTH, user = {}) {
    ensureResendConfigured();
    const resend = new Resend(process.env.RESEND_API_KEY);
    const expiresText = `${OTP_TTL_MINUTES} phút`;
    const isRegistration = purpose === OTP_PURPOSE_REGISTRATION;
    const isPasswordReset = purpose === OTP_PURPOSE_PASSWORD_RESET;
    const subject = isPasswordReset
        ? 'Mã OTP đặt lại mật khẩu'
        : isRegistration
          ? 'Mã OTP hoàn tất đăng ký'
          : 'Mã OTP xác thực tài khoản';
    const heading = isPasswordReset
        ? 'Đặt lại mật khẩu'
        : isRegistration
          ? 'Xác minh email đăng ký'
          : 'Mã xác thực tài khoản';
    const brandName = String(process.env.OTP_BRAND_NAME || 'FloodWatch').trim() || 'FloodWatch';
    const intro = isPasswordReset
        ? `Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản ${brandName}. Dùng mã bên dưới để xác nhận và nhập mật khẩu mới.`
        : isRegistration
          ? `Dùng mã bên dưới để hoàn tất đăng ký ${brandName}. Sau khi xác minh email, bạn có thể đăng nhập vào hệ thống.`
          : `Bạn vừa yêu cầu mã xác thực để tiếp tục sử dụng tài khoản ${brandName}.`;

    const name = user.full_name != null ? String(user.full_name).trim() : '';
    const greeting = name ? `Xin chào ${name},` : 'Xin chào,';

    const dateDisplay = new Date().toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    const supportEmail =
        String(process.env.OTP_SUPPORT_EMAIL || '').trim() || parseFromEmailAddress();
    const helpUrl =
        String(process.env.OTP_HELP_URL || process.env.PUBLIC_WEB_URL || '#').trim() || '#';

    const templateId = String(process.env.RESEND_OTP_TEMPLATE_ID).trim();

    await resend.emails.send({
        from: process.env.OTP_FROM_EMAIL,
        to: [email],
        subject,
        template: {
            id: templateId,
            variables: {
                OTP_CODE: String(code),
                EXPIRES_TEXT: expiresText,
                HEADING: heading,
                INTRO: intro,
                GREETING: greeting,
                DATE_DISPLAY: dateDisplay,
                BRAND_NAME: brandName,
                SUPPORT_EMAIL: supportEmail,
                HELP_URL: helpUrl,
                COPYRIGHT_YEAR: String(new Date().getFullYear())
            }
        }
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

        const purpose = user.email_verified_at ? OTP_PURPOSE_AUTH : OTP_PURPOSE_REGISTRATION;

        const lastOtp = await otpRepository.findLatestActiveByEmailAnyPurpose(normalizedEmail);
        if (lastOtp) {
            const diffMs = Date.now() - new Date(lastOtp.created_at).getTime();
            const cooldownMs = OTP_RESEND_COOLDOWN_SECONDS * 1000;
            if (diffMs < cooldownMs) {
                const waitSec = Math.ceil((cooldownMs - diffMs) / 1000);
                throw new Error(`Vui lòng chờ ${waitSec}s trước khi gửi lại OTP`);
            }
        }

        const recentCount = await otpRepository.countRecentByEmailAllPurposes(normalizedEmail, 60);
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
            purpose
        });

        await sendOtpEmail(normalizedEmail, code, purpose, user);
        return toPublicOtp(otp);
    },

    /**
     * OTP quên mật khẩu — chỉ tài khoản đã xác minh email, đang hoạt động.
     */
    async sendForgotPasswordOtp(email) {
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail) {
            throw new Error('Thiếu email');
        }

        const user = await userRepository.findByEmail(normalizedEmail);
        if (!user) throw new Error('Email chưa được đăng ký');
        if (!user.is_active) throw new Error('Tài khoản đã bị vô hiệu hóa');
        if (!user.email_verified_at) {
            throw new Error('Vui lòng xác minh email trước khi dùng chức năng quên mật khẩu');
        }

        const lastOtp = await otpRepository.findLatestActiveByEmailAnyPurpose(normalizedEmail);
        if (lastOtp) {
            const diffMs = Date.now() - new Date(lastOtp.created_at).getTime();
            const cooldownMs = OTP_RESEND_COOLDOWN_SECONDS * 1000;
            if (diffMs < cooldownMs) {
                const waitSec = Math.ceil((cooldownMs - diffMs) / 1000);
                throw new Error(`Vui lòng chờ ${waitSec}s trước khi gửi lại OTP`);
            }
        }

        const recentCount = await otpRepository.countRecentByEmailAllPurposes(normalizedEmail, 60);
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
            purpose: OTP_PURPOSE_PASSWORD_RESET
        });

        await sendOtpEmail(normalizedEmail, code, OTP_PURPOSE_PASSWORD_RESET, user);
        return toPublicOtp(otp);
    },

    async resendOtp(email) {
        return await this.sendOtp(email);
    },

    async verifyOtpForPurpose(email, code, purpose) {
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail || !code || !purpose) {
            throw new Error('Thiếu email, otp_code hoặc purpose không hợp lệ');
        }

        const otp = await otpRepository.findLatestActiveByEmail(normalizedEmail, purpose);
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
            verified_at: new Date().toISOString(),
            user_id: otp.user_id,
            purpose: otp.purpose
        };
    },

    async verifyOtp(email, code) {
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail || !code) {
            throw new Error('Thiếu email hoặc otp_code');
        }

        const otp = await otpRepository.findLatestActiveByEmailAnyPurpose(normalizedEmail);
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
            verified_at: new Date().toISOString(),
            user_id: otp.user_id,
            purpose: otp.purpose
        };
    },

    OTP_PURPOSE_PASSWORD_RESET
};

module.exports = otpService;
