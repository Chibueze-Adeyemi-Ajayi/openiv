/**
 * Fetch wrapper for the OpenIV backend.
 *
 * **Auth model:** HttpOnly session cookie. The browser sends `openiv_sid` automatically on
 * every request once login has set it. We use `credentials: 'include'` so the cookie survives
 * the cross-origin dev setup (Vite :5173 → API :8080). In production, frontend + API should
 * be same-origin behind a reverse proxy and `credentials: 'same-origin'` would suffice; we
 * keep `'include'` because it works in both configurations.
 *
 * The frontend **never holds the session token** — JavaScript can't read HttpOnly cookies,
 * which removes XSS as a token-theft vector.
 */

const SANDBOX_ENABLED_KEY = 'openiv_sandbox_enabled'
const SANDBOX_URL_KEY = 'openiv_sandbox_url'

export function getBaseUrl(): string {
  const sandboxEnabled = localStorage.getItem(SANDBOX_ENABLED_KEY) === 'true'
  if (sandboxEnabled) {
    const sandboxUrl = localStorage.getItem(SANDBOX_URL_KEY)
    if (sandboxUrl) return sandboxUrl.replace(/\/$/, '')
  }

  return (
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
    ''
  )
}

export const BASE_URL = getBaseUrl()

export class ApiError extends Error {
  status: number
  code: string
  detail: string | null
  correlationId: string | null
  extra: Record<string, unknown>

  constructor(status: number, code: string, detail: string | null, correlationId: string | null, extra: Record<string, unknown> = {}) {
    super(`${code}${detail ? ':' + detail : ''}`)
    this.status = status
    this.code = code
    this.detail = detail
    this.correlationId = correlationId
    this.extra = extra
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  /** Internal — prevents infinite retry loop on 401. */
  _retried?: boolean
}

/** Converts a server-relative media path (e.g. /uploads/avatars/x.jpg) into an absolute URL using the configured API base, so it works in cross-origin dev setups. */
export function resolveMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${getBaseUrl()}${path}`
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...opts.headers,
  }
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    // Include cookies (and accept Set-Cookie) for cross-origin dev. Works same-origin too.
    credentials: 'include',
  })

  if (response.status === 204) {
    return undefined as T
  }

  // 401 on a non-auth route: check whether the session cookie is still alive.
  // If yes, the 401 was transient — retry once. If no, the session is gone —
  // redirect to login with ?expired=1 so the page can surface the right message.
  if (
    response.status === 401 &&
    !path.startsWith('/api/v1/auth/') &&
    !opts._retried
  ) {
    try {
      const check = await fetch(`${getBaseUrl()}/api/v1/auth/session`, { credentials: 'include' })
      if (check.ok) {
        // Session still valid — transient 401, retry once.
        return apiRequest<T>(path, { ...opts, _retried: true })
      }
    } catch {
      // Network error during check — fall through to redirect.
    }
    // Session gone — navigate away. Return a never-resolving promise so the
    // caller doesn't get a partially-handled response before the page unloads.
    window.location.replace('/auth/login?expired=1')
    return new Promise<T>(() => {})
  }

  const ct = response.headers.get('content-type') ?? ''
  const isJson = ct.includes('application/json')
  const data = isJson ? await response.json() : await response.text()

  if (!response.ok) {
    const body = (isJson ? data : {}) as Record<string, unknown>
    const { error, detail, correlationId, ...extra } = body
    throw new ApiError(
      response.status,
      (error as string | undefined) ?? `http_${response.status}`,
      (detail as string | undefined) ?? null,
      (correlationId as string | undefined) ?? null,
      extra,
    )
  }

  return data as T
}
