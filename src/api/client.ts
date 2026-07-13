/**
 * Fetch wrapper for the OpenIV backend — trimmed for the public marketing/landing
 * app (no session cookie, no sandbox override, no auth-expiry redirect; every
 * endpoint this app calls is unauthenticated, e.g. POST /api/v1/access-requests).
 */

export function getBaseUrl(): string {
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
}

/** Converts a server-relative media path into an absolute URL using the configured API base. */
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
    credentials: 'include',
  })

  if (response.status === 204) {
    return undefined as T
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
