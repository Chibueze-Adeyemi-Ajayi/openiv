import { apiRequest, BASE_URL as API_BASE } from './client'

// ── Base64url helpers ─────────────────────────────────────────────────────

function bufToB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function b64ToBuf(b64: string): ArrayBuffer {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(padded)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

// ── API calls ─────────────────────────────────────────────────────────────

export function webAuthnSupported(): boolean {
  return typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined'
}

export async function checkEnrolled(): Promise<boolean> {
  const res = await apiRequest<{ enrolled: boolean }>('/api/v1/auth/webauthn/status')
  return res.enrolled
}

// ── Registration ──────────────────────────────────────────────────────────

interface RegStartOptions {
  challenge: string
  rp: { name: string; id: string }
  user: { id: string; name: string; displayName: string }
  pubKeyCredParams: { type: string; alg: number }[]
  authenticatorSelection: Record<string, string>
  attestation: string
  timeout: number
}

export async function registerBiometric(): Promise<void> {
  // 1. Get options from server
  const options = await apiRequest<RegStartOptions>(
    '/api/v1/auth/webauthn/register/start', { method: 'POST', body: {} }
  )

  // 2. Call browser WebAuthn API
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: b64ToBuf(options.challenge),
      rp: options.rp,
      user: {
        id: b64ToBuf(options.user.id),
        name: options.user.name,
        displayName: options.user.displayName,
      },
      pubKeyCredParams: options.pubKeyCredParams.map(p => ({
        type: p.type as PublicKeyCredentialType,
        alg: p.alg,
      })),
      authenticatorSelection: {
        authenticatorAttachment: 'platform' as AuthenticatorAttachment,
        userVerification: 'required' as UserVerificationRequirement,
        residentKey: 'preferred' as ResidentKeyRequirement,
      },
      attestation: 'none',
      timeout: options.timeout,
    },
  }) as PublicKeyCredential | null

  if (!credential) throw new Error('No credential returned')

  const response = credential.response as AuthenticatorAttestationResponse

  // 3. Send attestation to server
  await apiRequest('/api/v1/auth/webauthn/register/finish', {
    method: 'POST',
    body: {
      id: credential.id,
      clientDataJSON: bufToB64(response.clientDataJSON),
      attestationObject: bufToB64(response.attestationObject),
    },
  })
}

interface AuthStartOptions {
  challenge: string
  rpId: string
  allowCredentials: { type: string; id: string }[]
  userVerification: string
  timeout: number
}

// ── Login challenge ───────────────────────────────────────────────────────

export async function loginChallenge(): Promise<void> {
  const options = await apiRequest<AuthStartOptions>(
    '/api/v1/auth/webauthn/challenge/start', { method: 'POST', body: {} }
  )

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: b64ToBuf(options.challenge),
      rpId: options.rpId,
      allowCredentials: options.allowCredentials.map(c => ({
        type: c.type as PublicKeyCredentialType,
        id: b64ToBuf(c.id),
      })),
      userVerification: 'required' as UserVerificationRequirement,
      timeout: options.timeout,
    },
  }) as PublicKeyCredential | null

  if (!assertion) throw new Error('No assertion returned')

  const response = assertion.response as AuthenticatorAssertionResponse

  await apiRequest('/api/v1/auth/webauthn/challenge/finish', {
    method: 'POST',
    body: {
      id: assertion.id,
      authenticatorData: bufToB64(response.authenticatorData),
      clientDataJSON: bufToB64(response.clientDataJSON),
      signature: bufToB64(response.signature),
    },
  })
}

// ── Unauthenticated biometric login ──────────────────────────────────────

/**
 * Full passwordless biometric login flow:
 * 1. POST /auth/webauthn/login/start  — server creates PENDING_BIOMETRIC_CHALLENGE session + sets cookie
 * 2. navigator.credentials.get()      — browser prompts Face ID / Touch ID
 * 3. POST /auth/webauthn/challenge/finish — verifies assertion, session → AUTHENTICATED
 */
export async function loginWithBiometric(email: string): Promise<{ nextState: string }> {
  const options = await apiRequest<AuthStartOptions>(
    '/api/v1/auth/webauthn/login/start', { method: 'POST', body: { email } }
  )

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: b64ToBuf(options.challenge),
      rpId: options.rpId,
      allowCredentials: options.allowCredentials.map(c => ({
        type: c.type as PublicKeyCredentialType,
        id: b64ToBuf(c.id),
      })),
      userVerification: 'required' as UserVerificationRequirement,
      timeout: options.timeout,
    },
  }) as PublicKeyCredential | null

  if (!assertion) throw new Error('No assertion returned')

  const response = assertion.response as AuthenticatorAssertionResponse

  return apiRequest<{ nextState: string }>('/api/v1/auth/webauthn/challenge/finish', {
    method: 'POST',
    body: {
      id: assertion.id,
      authenticatorData: bufToB64(response.authenticatorData),
      clientDataJSON: bufToB64(response.clientDataJSON),
      signature: bufToB64(response.signature),
    },
  })
}

// ── Authentication (step-up) ──────────────────────────────────────────────

export async function verifyBiometric(): Promise<void> {
  // 1. Get challenge from server
  const options = await apiRequest<AuthStartOptions>(
    '/api/v1/auth/webauthn/authenticate/start', { method: 'POST', body: {} }
  )

  // 2. Call browser WebAuthn API
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: b64ToBuf(options.challenge),
      rpId: options.rpId,
      allowCredentials: options.allowCredentials.map(c => ({
        type: c.type as PublicKeyCredentialType,
        id: b64ToBuf(c.id),
      })),
      userVerification: 'required' as UserVerificationRequirement,
      timeout: options.timeout,
    },
  }) as PublicKeyCredential | null

  if (!assertion) throw new Error('No assertion returned')

  const response = assertion.response as AuthenticatorAssertionResponse

  // 3. Send assertion to server for verification
  await apiRequest('/api/v1/auth/webauthn/authenticate/finish', {
    method: 'POST',
    body: {
      id: assertion.id,
      authenticatorData: bufToB64(response.authenticatorData),
      clientDataJSON: bufToB64(response.clientDataJSON),
      signature: bufToB64(response.signature),
    },
  })
}
