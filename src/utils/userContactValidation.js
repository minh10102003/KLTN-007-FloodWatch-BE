/**
 * Validate họ tên, email, số điện thoại (đăng ký / cập nhật profile / admin tạo user).
 * Email: định dạng chặt + chặn domain email tạm phổ biến.
 * SĐT: di động Việt Nam (0[35789]xxxxxxxxx hoặc +84).
 */

const NAME_MIN = 2;
const NAME_MAX = 100;

const FAKE_NAME_TOKENS = new Set([
    'test',
    'xxx',
    'khongco',
    'khôngcó',
    'n/a',
    'na',
    'null',
    'undefined',
    'noname',
    'user',
    'admin',
    'fullname',
    'hoten',
    'họtên',
    'asd',
    'qwe',
    'abc',
]);

/** Domain email dùng một lần / rác — không chấp nhận làm email liên hệ thật. */
const DISPOSABLE_EMAIL_DOMAINS = [
    'mailinator.com',
    'yopmail.com',
    'guerrillamail.com',
    '10minutemail.com',
    'temp-mail.org',
    'tempmail.com',
    'throwaway.email',
    'trashmail.com',
    'fakeinbox.com',
    'getnada.com',
    'maildrop.cc',
];

function collapseWhitespace(s) {
    return String(s || '')
        .trim()
        .replace(/\s+/g, ' ');
}

/**
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
function validateFullName(raw) {
    const name = collapseWhitespace(raw);
    if (!name) {
        return { ok: false, error: 'Họ và tên không được để trống.' };
    }
    if (name.length < NAME_MIN) {
        return { ok: false, error: `Họ và tên tối thiểu ${NAME_MIN} ký tự.` };
    }
    if (name.length > NAME_MAX) {
        return { ok: false, error: `Họ và tên tối đa ${NAME_MAX} ký tự.` };
    }
    if (!/^[\p{L}\s'.-]+$/u.test(name)) {
        return {
            ok: false,
            error: 'Họ và tên chỉ được chứa chữ cái (Unicode), khoảng trắng và các ký tự . \' -',
        };
    }
    const letters = name.match(/\p{L}/gu) || [];
    if (letters.length < 2) {
        return { ok: false, error: 'Họ và tên phải có ít nhất 2 chữ cái (vui lòng nhập họ tên thật).' };
    }
    const compact = name.toLowerCase().replace(/\s+/g, '');
    if (FAKE_NAME_TOKENS.has(compact)) {
        return { ok: false, error: 'Vui lòng nhập họ và tên thật, không dùng từ khóa chung chung.' };
    }
    return { ok: true, value: name };
}

function normalizeEmail(raw) {
    return String(raw || '')
        .trim()
        .toLowerCase();
}

function isDisposableEmailDomain(domain) {
    const d = domain.toLowerCase();
    return DISPOSABLE_EMAIL_DOMAINS.some((b) => d === b || d.endsWith(`.${b}`));
}

/**
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
function validateEmail(raw) {
    const email = normalizeEmail(raw);
    if (!email) {
        return { ok: false, error: 'Email không được để trống.' };
    }
    if (email.length > 254) {
        return { ok: false, error: 'Email quá dài.' };
    }
    if (email.includes('..') || email.split('@').length !== 2) {
        return { ok: false, error: 'Định dạng email không hợp lệ.' };
    }
    const [local, domain] = email.split('@');
    if (local.length < 1 || local.length > 64) {
        return { ok: false, error: 'Định dạng email không hợp lệ (phần trước @).' };
    }
    if (!domain || !domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
        return { ok: false, error: 'Định dạng email không hợp lệ (phần sau @).' };
    }
    const tld = domain.split('.').pop();
    if (!tld || tld.length < 2 || !/^[a-z]{2,63}$/i.test(tld)) {
        return { ok: false, error: 'Định dạng email không hợp lệ (tên miền).' };
    }
    if (!/^[a-z0-9]([a-z0-9._+-]*[a-z0-9])?$/i.test(local)) {
        return { ok: false, error: 'Email không hợp lệ (phần trước @).' };
    }
    if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9.-]*[a-z0-9])?)+$/i.test(domain)) {
        return { ok: false, error: 'Email không hợp lệ (phần sau @).' };
    }
    if (isDisposableEmailDomain(domain)) {
        return { ok: false, error: 'Không chấp nhận email tạm / dùng một lần. Vui lòng dùng email thật.' };
    }
    return { ok: true, value: email };
}

/**
 * Chuẩn hóa về dạng 0xxxxxxxxx (10 số, di động VN).
 */
function normalizeVnPhone(raw) {
    let s = String(raw || '').trim().replace(/[\s.\-()]/g, '');
    if (!s) return '';
    if (s.startsWith('+84')) s = `0${s.slice(3)}`;
    else if (s.startsWith('84') && s.length === 11) s = `0${s.slice(2)}`;
    return s;
}

/**
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
function validateVnPhone(raw) {
    const n = normalizeVnPhone(raw);
    if (!n) {
        return { ok: false, error: 'Số điện thoại không được để trống.' };
    }
    if (!/^0(3|5|7|8|9)[0-9]{8}$/.test(n)) {
        return {
            ok: false,
            error: 'Số điện thoại không hợp lệ. Nhập số di động Việt Nam (vd: 09xxxxxxxx, 03xxxxxxxx, hoặc +84…).',
        };
    }
    return { ok: true, value: n };
}

/**
 * Gói validate 3 trường cốt lõi (họ tên, email, SĐT).
 * @param {{ full_name?: string, fullName?: string, email?: string, phone?: string }} input
 * @returns {{ ok: true, values: { full_name: string, email: string, phone: string } } | { ok: false, error: string, details: Record<string, string> }}
 */
function validateUserCoreContact(input) {
    const rawName = input.full_name !== undefined ? input.full_name : input.fullName;
    const details = {};

    const vn = validateFullName(rawName);
    if (!vn.ok) details.full_name = vn.error;

    const em = validateEmail(input.email);
    if (!em.ok) details.email = em.error;

    const ph = validateVnPhone(input.phone);
    if (!ph.ok) details.phone = ph.error;

    const keys = Object.keys(details);
    if (keys.length > 0) {
        return {
            ok: false,
            error: details[keys[0]],
            details,
        };
    }
    return {
        ok: true,
        values: {
            full_name: vn.value,
            email: em.value,
            phone: ph.value,
        },
    };
}

module.exports = {
    validateFullName,
    validateEmail,
    validateVnPhone,
    normalizeVnPhone,
    normalizeEmail,
    collapseWhitespace,
    validateUserCoreContact,
};
