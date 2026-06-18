/**
 * Client-side onboarding state.
 *
 * **Session token lives in an HttpOnly cookie, not here.** JavaScript cannot read it and XSS
 * cannot exfiltrate it — the browser just sends it automatically on requests from our origin.
 * The frontend asks `GET /api/v1/auth/session` if it needs to know the current session state.
 *
 * This module only holds **onboarding breadcrumbs** — values that improve UX between pages
 * (prefilling the email, tracking whether we're mid-invitation-claim, etc.). Even so, we
 * encrypt them with AES-GCM (see `./crypto.ts`). Plaintext AES keys also live in
 * sessionStorage, so this is not defense-against-same-origin-XSS — read the docstring at the
 * top of `./crypto.ts` for the exact threat model this covers.
 *
 * Values are written async (crypto is a Promise); a small in-memory cache keeps reads sync
 * for the common case once a value is first materialized.
 */

import { decryptString, destroyKey, encryptString } from './crypto'

const KEYS = {
  sessionState: 'openiv.sessionState',
  inviteEmail: 'openiv.inviteEmail',
  // We keep the invite code locally for the duration of the onboarding flow so step 2 (login)
  // can claim it. A better design is a server-side "invite ticket"; see follow-ups.
  inviteCode: 'openiv.inviteCode',
  loginEmail: 'openiv.loginEmail',
  loginName: 'openiv.loginName',
  loginAvatar: 'openiv.loginAvatar',
} as const

type Key = (typeof KEYS)[keyof typeof KEYS]

export type SessionState =
  | 'pending_email_verification'
  | 'must_change_password'
  | 'pending_totp_setup'
  | 'pending_totp_challenge'
  | 'pending_biometric_setup'
  | 'pending_biometric_challenge'
  | 'authenticated'

const cache = new Map<string, string | null>()

async function writeEncrypted(key: Key, value: string | null): Promise<void> {
  if (value === null) {
    sessionStorage.removeItem(key)
    cache.set(key, null)
    return
  }
  const ct = await encryptString(value)
  sessionStorage.setItem(key, ct)
  cache.set(key, value)
}

async function readEncrypted(key: Key): Promise<string | null> {
  if (cache.has(key)) return cache.get(key) ?? null
  const ct = sessionStorage.getItem(key)
  if (ct === null) {
    cache.set(key, null)
    return null
  }
  const pt = await decryptString(ct)
  cache.set(key, pt)
  return pt
}

/** Synchronous read from cache — returns null if the value hasn't been hydrated via `hydrate()` yet. */
function readCached(key: Key): string | null {
  return cache.get(key) ?? null
}

export const setSessionState = (s: SessionState | null) => writeEncrypted(KEYS.sessionState, s)
export const getSessionState = (): SessionState | null =>
  readCached(KEYS.sessionState) as SessionState | null

export const setInviteEmail = (v: string | null) => writeEncrypted(KEYS.inviteEmail, v)
export const getInviteEmail = () => readCached(KEYS.inviteEmail)

export const setInviteCode = (v: string | null) => writeEncrypted(KEYS.inviteCode, v)
export const getInviteCode = () => readCached(KEYS.inviteCode)

export const setLoginEmail = (v: string | null) => writeEncrypted(KEYS.loginEmail, v)
export const getLoginEmail = () => readCached(KEYS.loginEmail)

export const setLoginName = (v: string | null) => writeEncrypted(KEYS.loginName, v)
export const getLoginName = () => readCached(KEYS.loginName)

export const setLoginAvatar = (v: string | null) => writeEncrypted(KEYS.loginAvatar, v)
export const getLoginAvatar = () => readCached(KEYS.loginAvatar)

/**
 * Load all breadcrumbs from (encrypted) sessionStorage into the in-memory cache. Call once at
 * app startup (or on each page mount that needs the data) before reading with the sync getters.
 */
export async function hydrate(): Promise<void> {
  await Promise.all(Object.values(KEYS).map((k) => readEncrypted(k)))
}

/** Wipe everything including the crypto key — full logout. */
export function clearOnboardingState(): void {
  Object.values(KEYS).forEach((k) => sessionStorage.removeItem(k))
  cache.clear()
  destroyKey()
}

/** Wipe breadcrumbs but keep nothing — the session token is in an HttpOnly cookie anyway. */
export function clearOnboardingBreadcrumbs(): void {
  setInviteCode(null)
  setInviteEmail(null)
  setLoginEmail(null)
  setLoginName(null)
}

/** Wipe only the invite-related fields (after the invite is claimed). */
export function clearInviteState(): void {
  setInviteCode(null)
  setInviteEmail(null)
}
