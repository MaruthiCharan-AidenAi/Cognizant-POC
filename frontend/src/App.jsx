import { useEffect, useRef } from 'react'
import { useAuth } from './hooks/useAuth'
import ChatWindow from './components/ChatWindow'

export default function App() {
  const {
    token,
    user,
    isAuthenticated,
    isLoading,
    isVerifyingLogin,
    loginError,
    renderSignInButton,
    signOut,
  } = useAuth()
  const signInRef = useRef(null)

  // Render Google Sign-In button when not authenticated
  useEffect(() => {
    if (!isAuthenticated && !isLoading && signInRef.current) {
      renderSignInButton(signInRef.current)
    }
  }, [isAuthenticated, isLoading, renderSignInButton])

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-gradient-to-br from-gcp-gray-50 via-white to-gcp-blue-light">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 border-4 border-gcp-blue/20 border-t-gcp-blue rounded-full animate-spin" />
          <p className="text-sm text-gcp-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  // OAuth succeeded — backend is verifying JWT and BigQuery access
  if (isVerifyingLogin) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-gradient-to-br from-gcp-gray-50 via-white to-gcp-blue-light">
        <div className="flex flex-col items-center gap-4 max-w-sm mx-4 text-center animate-fade-in">
          <div className="w-12 h-12 border-4 border-gcp-blue/20 border-t-gcp-blue rounded-full animate-spin" />
          <div>
            <p className="text-sm font-medium text-gcp-gray-800">Signing you in</p>
            <p className="text-sm text-gcp-gray-500 mt-1">
              Verifying your account and access permissions…
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Not authenticated — show login screen
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] px-3 py-6 sm:p-6 bg-gradient-to-br from-gcp-gray-50 via-white to-gcp-blue-light">
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-10 max-w-md w-full text-center animate-fade-in">
          {/* Logo / Icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-gcp-blue to-gcp-blue-dark flex items-center justify-center shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gcp-gray-900 mb-2">
            Analytics Chatbot
          </h1>
          <p className="text-gcp-gray-500 mb-8 leading-relaxed text-sm">
            Sign in with your Google account to access your analytics dashboard.
            Your access level is determined by your email.
          </p>

          {/* Login error banner */}
          {loginError && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 text-left">
              <span className="font-semibold">Sign-in failed: </span>{loginError}
            </div>
          )}

          {/* Google Sign-In Button */}
          <div className="flex justify-center mb-6">
            <div ref={signInRef} id="google-signin-button" />
          </div>

          {/* Info section */}
          
        </div>
      </div>
    )
  }

  // Authenticated — show chat
  return <ChatWindow token={token} user={user} onSignOut={signOut} />
}
