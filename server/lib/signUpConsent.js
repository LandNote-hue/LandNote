/**
 * 회원가입 약관 동의 백엔드 검증 (BFF / 커스텀 API용)
 * Supabase Auth 직접 가입 시에는 supabase/migrations/005_user_terms_consents.sql 트리거가 동일 규칙을 적용합니다.
 */

/** @typedef {{ terms_version?: string, terms_required_agreed?: boolean, marketing_agreed?: boolean, terms_agreed_at?: string, terms_items?: unknown[] }} SignUpConsentBody */

export const CURRENT_TERMS_VERSION = 'v1.0';

export const SIGNUP_CONSENT_ERROR = {
  TERMS_REQUIRED: { code: 'TERMS_REQUIRED', message: '필수 약관에 동의해주세요.', status: 400 },
  TERMS_VERSION_REQUIRED: { code: 'TERMS_VERSION_REQUIRED', message: '약관 버전 정보가 없습니다.', status: 400 },
  TERMS_VERSION_INVALID: { code: 'TERMS_VERSION_INVALID', message: '유효하지 않은 약관 버전입니다.', status: 400 },
  INVALID_PAYLOAD: { code: 'INVALID_CONSENT_PAYLOAD', message: '약관 동의 데이터 형식이 올바르지 않습니다.', status: 400 },
};

/**
 * @param {SignUpConsentBody|null|undefined} consent
 */
export function validateSignUpConsent(consent) {
  if (!consent || typeof consent !== 'object') {
    return { ok: false, error: SIGNUP_CONSENT_ERROR.INVALID_PAYLOAD };
  }

  const termsVersion = typeof consent.terms_version === 'string'
    ? consent.terms_version.trim()
    : '';

  if (!termsVersion) {
    return { ok: false, error: SIGNUP_CONSENT_ERROR.TERMS_VERSION_REQUIRED };
  }

  if (consent.terms_required_agreed !== true) {
    return { ok: false, error: SIGNUP_CONSENT_ERROR.TERMS_REQUIRED };
  }

  const marketingAgreed = consent.marketing_agreed === true;
  let agreedAt = typeof consent.terms_agreed_at === 'string' ? consent.terms_agreed_at.trim() : '';
  if (!agreedAt || Number.isNaN(Date.parse(agreedAt))) {
    agreedAt = new Date().toISOString();
  }

  const termsItems = Array.isArray(consent.terms_items) ? consent.terms_items : [];

  return {
    ok: true,
    value: {
      terms_version: termsVersion,
      terms_required_agreed: true,
      marketing_agreed: marketingAgreed,
      terms_agreed_at: agreedAt,
      terms_items: termsItems,
    },
  };
}

/**
 * @param {SignUpConsentBody|null|undefined} consent
 */
export function assertSignUpConsent(consent) {
  const result = validateSignUpConsent(consent);
  if (!result.ok) {
    const err = new Error(result.error.message);
    err.code = result.error.code;
    err.status = result.error.status;
    throw err;
  }
  return result.value;
}

/**
 * Express 미들웨어 — req.body.consent 검증
 */
export function signUpConsentMiddleware(req, res, next) {
  try {
    req.validatedConsent = assertSignUpConsent(req.body?.consent);
    next();
  } catch (err) {
    res.status(err.status || 400).json({
      error: {
        code: err.code || SIGNUP_CONSENT_ERROR.INVALID_PAYLOAD.code,
        message: err.message,
      },
    });
  }
}
