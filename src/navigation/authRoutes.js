/** @type {Record<string, string>} */
export const AUTH_PATHS = {
  login: '/login',
  signup: '/signup',
  signupInvite: '/signup/invite',
};

/** @param {string} token */
export function buildInviteSignupPath(token) {
  return `${AUTH_PATHS.signupInvite}?token=${encodeURIComponent(token)}`;
}

/** @param {string} [origin] */
export function buildInviteSignupUrl(token, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  return `${origin}${buildInviteSignupPath(token)}`;
}
