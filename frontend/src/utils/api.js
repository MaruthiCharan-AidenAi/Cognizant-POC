/**
 * API utility — POST /chat with JWT header
 */

const API_BASE = import.meta.env.VITE_API_URL || ''

/**
 * Get the full URL for an API endpoint.
 */
export function apiUrl(path) {
  return `${API_BASE}${path}`
}

/**
 * Make an authenticated API request.
 */
export async function apiFetch(path, { token, method = 'GET', body = null } = {}) {
  const headers = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const options = {
    method,
    headers,
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(apiUrl(path), options)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw {
      status: response.status,
      error: errorData.error || 'unknown_error',
      detail: errorData.detail || `HTTP ${response.status}`,
      retry_after: errorData.retry_after,
    }
  }

  return response.json()
}

/**
 * Generate a unique session ID for the conversation.
 */
export function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}
