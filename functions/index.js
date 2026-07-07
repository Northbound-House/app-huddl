/**
 * Identity Platform blocking: controls which email domains may register or sign in.
 *
 * Per-project config via functions/.env.<projectId>:
 *   jh  (huddle-ab42f):  ALLOWED_AUTH_EMAIL_DOMAIN=jackhenry.com  → allow only @jackhenry.com
 *   pub (huddl-a3aec):   BLOCKED_AUTH_EMAIL_DOMAIN=jackhenry.com  → allow all except @jackhenry.com
 *
 * Deploy with: firebase deploy --only functions --project <jh|huddl>
 * Requires Firebase Authentication with Identity Platform; blocking functions URL is
 * registered automatically after first deploy (check Auth → Settings → Blocking functions).
 *
 * Error message must match DOMAIN_BLOCKING_ERROR_CODE in src/lib/authPolicy.js.
 */
import { setGlobalOptions } from 'firebase-functions/v2';
import { beforeUserCreated, beforeUserSignedIn, HttpsError } from 'firebase-functions/v2/identity';

setGlobalOptions({ region: 'us-central1' });

const ERR_MSG = 'HUDDL_DOMAIN_NOT_ALLOWED';

// Block-list takes precedence: deny this domain, allow all others.
const blockedDomain = process.env.BLOCKED_AUTH_EMAIL_DOMAIN?.trim().toLowerCase() || null;
// Allow-list: only this domain may sign in. Falls back to jackhenry.com if neither is set.
const allowedDomain = process.env.ALLOWED_AUTH_EMAIL_DOMAIN?.trim().toLowerCase() || 'jackhenry.com';

function assertAllowedAuthEmail(email) {
  if (!email || typeof email !== 'string') throw new HttpsError('invalid-argument', ERR_MSG);
  const at = email.lastIndexOf('@');
  if (at < 0) throw new HttpsError('invalid-argument', ERR_MSG);
  const domain = email.slice(at + 1).toLowerCase();

  if (blockedDomain) {
    if (domain === blockedDomain) throw new HttpsError('invalid-argument', ERR_MSG);
    return;
  }

  if (domain !== allowedDomain) throw new HttpsError('invalid-argument', ERR_MSG);
}

export const authBlockBeforeUserCreated = beforeUserCreated((event) => {
  assertAllowedAuthEmail(event.data?.email);
});

export const authBlockBeforeUserSignedIn = beforeUserSignedIn((event) => {
  assertAllowedAuthEmail(event.data?.email);
});
