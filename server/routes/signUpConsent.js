import { Router } from 'express';
import { assertSignUpConsent, SIGNUP_CONSENT_ERROR, validateSignUpConsent } from '../lib/signUpConsent.js';

/**
 * 약관 동의 검증 API (프론트 사전 검증·향후 BFF 가입 API용)
 * POST /api/signup/consent/validate
 * body: { consent: { terms_version, terms_required_agreed, marketing_agreed, ... } }
 */
export function createSignUpConsentRouter() {
  const router = Router();

  router.post('/validate', (req, res) => {
    const result = validateSignUpConsent(req.body?.consent);
    if (!result.ok) {
      return res.status(result.error.status).json({
        error: {
          code: result.error.code,
          message: result.error.message,
        },
      });
    }
    return res.json({ ok: true, consent: result.value });
  });

  router.post('/assert', (req, res) => {
    try {
      const consent = assertSignUpConsent(req.body?.consent);
      return res.json({ ok: true, consent });
    } catch (err) {
      return res.status(err.status || 400).json({
        error: {
          code: err.code || SIGNUP_CONSENT_ERROR.INVALID_PAYLOAD.code,
          message: err.message,
        },
      });
    }
  });

  return router;
}

export const SIGNUP_CONSENT_PATH = '/api/signup/consent';
