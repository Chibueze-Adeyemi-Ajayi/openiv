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

export const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:8080'

export class ApiError extends Error {
  status: number
  code: string
  detail: string | null
  correlationId: string | null

  constructor(status: number, code: string, detail: string | null, correlationId: string | null) {
    super(`${code}${detail ? ':' + detail : ''}`)
    this.status = status
    this.code = code
    this.detail = detail
    this.correlationId = correlationId
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    // Include cookies (and accept Set-Cookie) for cross-origin dev. Works same-origin too.
    credentials: 'include',
  })

  if (response.status === 204) {
    return undefined as T
  }

  const ct = response.headers.get('content-type') ?? ''
  const isJson = ct.includes('application/json')
  const data = isJson ? await response.json() : await response.text()

  if (!response.ok) {
    const body = (isJson ? data : {}) as {
      error?: string
      detail?: string
      correlationId?: string
    }
    throw new ApiError(
      response.status,
      body.error ?? `http_${response.status}`,
      body.detail ?? null,
      body.correlationId ?? null,
    )
  }

  return data as T
}
