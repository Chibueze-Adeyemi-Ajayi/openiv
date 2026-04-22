/**
 * AES-GCM encryption of the small pieces of onboarding state we hold in sessionStorage.
 *
 * **Threat model this actually defends against:**
 *   - A third-party browser extension or devtools user eyeballing sessionStorage values.
 *   - An operator (or malicious admin) shoulder-surfing DevTools → Application → Storage.
 *   - Accidental value leakage into error-reporting tools that snapshot storage.
 *
 * **What this does NOT defend against:** same-origin XSS running in the page can read the
 * key and decrypt just like legit code. The only real defense against that is not storing
 * anything sensitive client-side — which is why the session token lives in an HttpOnly cookie
 * (see `api/client.ts`). The values encrypted here are UX breadcrumbs (login email for prefill,
 * invite ticket), not authentication material.
 *
 * **Key lifecycle:** per-tab random 256-bit AES-GCM key, generated on first access and kept
 * in `sessionStorage` as JWK. Discarded when the tab closes. Rotating keys across tabs costs
 * nothing for our use case and prevents a tab restore from leaking old values.
 */

const KEY_STORAGE = 'openiv.cryptoKey'

async function getOrCreateKey(): Promise<CryptoKey> {
  const existing = sessionStorage.getItem(KEY_STORAGE)
  if (existing) {
    try {
      const jwk = JSON.parse(existing) as JsonWebKey
      return await crypto.subtle.importKey('jwk', jwk, { name: 'AES-GCM' }, true, [
        'encrypt',
        'decrypt',
      ])
    } catch {
      // fall through and regenerate
    }
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ])
  const jwk = await crypto.subtle.exportKey('jwk', key)
  sessionStorage.setItem(KEY_STORAGE, JSON.stringify(jwk))
  return key
}

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function encryptString(plaintext: string): Promise<string> {
  const key = await getOrCreateKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)),
  )
  const combined = new Uint8Array(iv.length + ct.length)
  combined.set(iv, 0)
  combined.set(ct, iv.length)
  return toBase64(combined)
}

export async function decryptString(ciphertext: string): Promise<string | null> {
  try {
    const key = await getOrCreateKey()
    const combined = fromBase64(ciphertext)
    const iv = combined.slice(0, 12)
    const ct = combined.slice(12)
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
    return new TextDecoder().decode(pt)
  } catch {
    return null
  }
}

/** Wipe the per-tab encryption key (and, therefore, invalidate any existing ciphertexts). */
export function destroyKey(): void {
  sessionStorage.removeItem(KEY_STORAGE)
}
