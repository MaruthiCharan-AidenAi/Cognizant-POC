import { useState, useEffect, useCallback } from 'react'

// Empty string = use Vite proxy (dev). Set VITE_API_URL for direct calls (prod).
const API_BASE = import.meta.env.VITE_API_URL ?? ''

/** Persists Google credential + user profile for embeds (e.g. Looker Studio) across reloads. */
const SESSION_STORAGE_KEY = 'analytics-chatbot-auth-v1'

function readStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (data?.token && data?.user?.email) {
      return { token: data.token, user: data.user }
    }
  } catch {
    /* ignore corrupt storage */
  }
  return null
}

function writeStoredSession(token, user) {
  try {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ token, user, savedAt: Date.now() })
    )
  } catch (e) {
    console.warn('Could not persist session to localStorage:', e)
  }
}

function clearStoredSession() {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * useAuth hook — Google Identity Services OAuth 2.0 sign-in.
 *
 * Flow:
 *  1. Google GIS returns a credential JWT to handleCredentialResponse
 *  2. We POST that JWT to /auth/login — backend verifies the JWT AND
 *     confirms the email is in BigQuery user_access
 *  3. Only if the backend returns 200 do we mark the user as authenticated
 *
 * Session is persisted in localStorage so reloads and embedded iframes (e.g. Looker Studio)
 * keep the user signed in until the JWT expires or they sign out. Restored sessions are
 * re-checked with /auth/login in the background.
 */
export function useAuth() {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  /** True while POST /auth/login runs (JWT + BigQuery user_access check). */
  const [isVerifyingLogin, setIsVerifyingLogin] = useState(false)
  const [loginError, setLoginError] = useState(null)

  /**
   * Decode a JWT payload without verification (verification is done server-side).
   */
  const parseJwt = useCallback((jwt) => {
    try {
      const base64Url = jwt.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
      return JSON.parse(jsonPayload)
    } catch {
      return null
    }
  }, [])

  /**
   * Call backend /auth/login to verify the JWT and confirm email in BigQuery.
   * Returns the user object from the backend on success, throws on failure.
   */
  const verifyWithBackend = useCallback(async (credential) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credential}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      let detail = 'Login failed'
      try {
        const body = await res.json()
        detail = body.detail || detail
      } catch {
        /* ignore parse errors */
      }

      if (res.status === 403) {
        throw new Error(`Access denied: ${detail}`)
      } else if (res.status === 401) {
        throw new Error(`Authentication failed: ${detail}`)
      } else {
        throw new Error(`Server error (${res.status}): ${detail}`)
      }
    }

    return res.json() // { status, email, role, region, name, picture }
  }, [])

  /**
   * Handle the credential response from Google Identity Services.
   */
  const handleCredentialResponse = useCallback(
    async (response) => {
      const credential = response.credential
      if (!credential) return

      setLoginError(null)
      setIsVerifyingLogin(true)

      try {
        const backendUser = await verifyWithBackend(credential)

        const nextUser = {
          email: backendUser.email,
          name: backendUser.name || parseJwt(credential)?.name,
          picture: backendUser.picture || parseJwt(credential)?.picture,
          role: backendUser.role,
          region: backendUser.region,
          email_verified: true,
        }
        setToken(credential)
        setUser(nextUser)
        writeStoredSession(credential, nextUser)
      } catch (err) {
        console.error('Login error:', err)
        setLoginError(err.message || 'Login failed. Please try again.')
      } finally {
        setIsVerifyingLogin(false)
      }
    },
    [parseJwt, verifyWithBackend]
  )

  /**
   * Hydrate from localStorage + init Google Identity Services.
   */
  useEffect(() => {
    let cancelled = false
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) {
      console.error('VITE_GOOGLE_CLIENT_ID is not set in environment variables')
      setIsLoading(false)
      return
    }

    const stored = readStoredSession()
    const restored = !!(stored?.token && stored?.user)

    if (restored) {
      setToken(stored.token)
      setUser(stored.user)
      // Refresh profile / detect expired or revoked JWT without blocking the UI (embed-friendly)
      verifyWithBackend(stored.token)
        .then((backendUser) => {
          if (cancelled) return
          const nextUser = {
            email: backendUser.email,
            name: backendUser.name || stored.user.name,
            picture: backendUser.picture || stored.user.picture,
            role: backendUser.role,
            region: backendUser.region,
            email_verified: true,
          }
          setUser(nextUser)
          writeStoredSession(stored.token, nextUser)
        })
        .catch(() => {
          if (cancelled) return
          setToken(null)
          setUser(null)
          clearStoredSession()
        })
      setIsLoading(false)
    }

    const initGIS = () => {
      if (!window.google?.accounts?.id) return false

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      })

      if (!restored) {
        setIsLoading(false)
      }
      return true
    }

    if (initGIS()) {
      return () => {
        cancelled = true
      }
    }

    const interval = setInterval(() => {
      if (initGIS()) {
        clearInterval(interval)
      }
    }, 100)

    const timeout = setTimeout(() => {
      clearInterval(interval)
      setIsLoading(false)
    }, 10000)

    return () => {
      cancelled = true
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [handleCredentialResponse, verifyWithBackend])

  /**
   * Render the Google Sign-In button in the given container element.
   */
  const renderSignInButton = useCallback((element) => {
    if (!element || !window.google?.accounts?.id) return

    window.google.accounts.id.renderButton(element, {
      theme: 'outline',
      size: 'large',
      type: 'standard',
      text: 'signin_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: 320,
    })
  }, [])

  /**
   * Sign out — clear state, storage, and disable auto-select.
   */
  const signOut = useCallback(() => {
    window.google?.accounts?.id?.disableAutoSelect()
    setToken(null)
    setUser(null)
    setLoginError(null)
    setIsVerifyingLogin(false)
    clearStoredSession()
  }, [])

  return {
    token,
    user,
    isAuthenticated: !!token,
    isLoading,
    isVerifyingLogin,
    loginError,
    renderSignInButton,
    signOut,
  }
}
