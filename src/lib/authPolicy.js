import { normalizeEmail } from '@/lib/email';

/**
 * Must match the message thrown by Cloud Functions blocking (Identity) auth, so the client
 * can show a clear toast instead of a generic `auth/internal-error` when the server blocks sign-in.
 */
export const DOMAIN_BLOCKING_ERROR_CODE = 'HUDDL_DOMAIN_NOT_ALLOWED';

// Allow-list: only this domain may sign in. Default: jackhenry.com.
// Set to empty string to disable allow-list mode.
const rawAllowed = import.meta.env.VITE_ALLOWED_AUTH_EMAIL_DOMAIN;
export const ALLOWED_AUTH_EMAIL_DOMAIN =
  typeof rawAllowed === 'string' && rawAllowed.trim().length > 0
    ? rawAllowed.trim().toLowerCase()
    : 'jackhenry.com';
export const ALLOW_ALL_DOMAINS = rawAllowed === '' || rawAllowed === 'false' || rawAllowed === 'null';

// Block-list: this domain is explicitly denied; all others are allowed.
// Takes precedence over allow-list when set.
const rawBlocked = import.meta.env.VITE_BLOCKED_AUTH_EMAIL_DOMAIN;
export const BLOCKED_AUTH_EMAIL_DOMAIN =
  typeof rawBlocked === 'string' && rawBlocked.trim().length > 0
    ? rawBlocked.trim().toLowerCase()
    : null;

/**
 * @param {string|null|undefined} email
 * @returns {boolean}
 */
export function isSignInEmailAllowed(email) {
  if (!email || typeof email !== 'string') return false;
  const e = normalizeEmail(email);
  if (!e.includes('@')) return false;
  const domain = e.slice(e.lastIndexOf('@') + 1);

  // Block-list mode: allow all except the blocked domain
  if (BLOCKED_AUTH_EMAIL_DOMAIN) return domain !== BLOCKED_AUTH_EMAIL_DOMAIN;

  // Allow-list mode: only the specified domain (or all if allow-all)
  if (ALLOW_ALL_DOMAINS) return true;
  return domain === ALLOWED_AUTH_EMAIL_DOMAIN;
}

/**
 * Circle membership invites use the same domain policy as sign-in.
 * @param {string|null|undefined} email
 * @returns {boolean}
 */
export function isCircleInviteEmailAllowed(email) {
  return isSignInEmailAllowed(email);
}
