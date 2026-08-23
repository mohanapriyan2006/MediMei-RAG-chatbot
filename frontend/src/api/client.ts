const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')

export const AUTH_LOGOUT_EVENT = 'MediMei:auth-logout'

function formatErrorDetail(detail: unknown): string {
  if (typeof detail === 'string') {
    return detail
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && 'msg' in item) {
          const loc = Array.isArray((item as Record<string, unknown>).loc)
            ? ((item as Record<string, unknown>).loc as string[]).slice(1).join('.')
            : ''
          const msg = (item as Record<string, unknown>).msg
          return loc ? `${loc}: ${msg}` : String(msg)
        }
        return JSON.stringify(item)
      })
      .join(', ')
  }
  if (detail && typeof detail === 'object') {
    return JSON.stringify(detail)
  }
  return String(detail)
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('labelproof_token')
  const headers: Record<string, string> = {}

  const taskId = typeof window !== 'undefined' ? (window as unknown as Record<string, string | undefined>).__medimeiTaskId : undefined
  if (taskId) {
    headers['X-Task-Id'] = taskId
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  if (options?.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headers[key] = value
      })
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([key, value]) => {
        headers[key] = value
      })
    } else {
      Object.assign(headers, options.headers)
    }
  }

  // Only set application/json Content-Type if there is a body, it's not FormData, and not already specified
  if (options?.body !== undefined && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  const res = await fetch(`${BASE_URL}${normalizedPath}`, {
    ...options,
    headers,
  })

  const isLoginPath = path === '/api/v1/auth/login'

  if (res.status === 401 && !isLoginPath) {
    localStorage.removeItem('labelproof_token')
    window.dispatchEvent(new CustomEvent(AUTH_LOGOUT_EVENT))
    throw new Error('Session expired. Please sign in again.')
  }

  if (!res.ok) {
    let detail = `API ${res.status}: ${res.statusText}`
    try {
      const body = await res.json()
      if (body?.detail) {
        detail = formatErrorDetail(body.detail)
      } else if (body?.message && typeof body.message === 'string') {
        detail = body.message
      }
    } catch {
      // response has no JSON body
    }
    throw new Error(detail)
  }

  if (res.status === 204) {
    return undefined as T
  }

  const text = await res.text()
  if (!text) {
    return undefined as T
  }

  try {
    return JSON.parse(text) as T
  } catch {
    return text as unknown as T
  }
}

