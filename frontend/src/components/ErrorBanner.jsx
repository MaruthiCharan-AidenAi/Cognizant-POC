/**
 * ErrorBanner — displays contextual error messages.
 * 
 * Handles: 429 rate limit, auth errors, network errors, etc.
 */
export default function ErrorBanner({ error, onDismiss }) {
  if (!error) return null

  const config = {
    rate_limit: {
      icon: '⏱',
      title: 'Too Many Requests',
      message: `Please wait ${error.retry_after || 60} seconds before trying again.`,
      bg: 'bg-gcp-yellow-light',
      border: 'border-gcp-yellow',
      text: 'text-yellow-800',
    },
    auth_error: {
      icon: '🔒',
      title: 'Authentication Error',
      message: error.detail || 'Your session has expired. Please refresh the page.',
      bg: 'bg-gcp-red-light',
      border: 'border-gcp-red',
      text: 'text-red-800',
    },
    network_error: {
      icon: '🌐',
      title: 'Connection Error',
      message: 'Unable to reach the server. Please check your connection.',
      bg: 'bg-gcp-red-light',
      border: 'border-gcp-red',
      text: 'text-red-800',
    },
    service_unavailable: {
      icon: '!',
      title: 'Service Temporarily Unavailable',
      message:
        error.detail ||
        'An upstream service is busy or unreachable. Please try again shortly.',
      bg: 'bg-gcp-yellow-light',
      border: 'border-gcp-yellow',
      text: 'text-yellow-900',
    },
    unknown_error: {
      icon: '⚠️',
      title: 'Something Went Wrong',
      message: error.detail || 'An unexpected error occurred. Please try again.',
      bg: 'bg-gcp-red-light',
      border: 'border-gcp-red',
      text: 'text-red-800',
    },
  }

  // Map HTTP status to error type
  let errorType = error.error || 'unknown_error'
  if (error.status === 429) errorType = 'rate_limit'
  else if (error.status === 401 || error.status === 403) errorType = 'auth_error'
  else if (error.status === 503) errorType = 'service_unavailable'
  else if (error.status === 0) errorType = 'network_error'

  const c = config[errorType] || config.unknown_error

  return (
    <div
      id={`error-banner-${errorType}`}
      className={`
        flex items-start gap-2 sm:gap-3 px-3 py-2.5 sm:px-4 sm:py-3 mx-3 sm:mx-4 mb-2 sm:mb-3 rounded-xl
        border ${c.bg} ${c.border} ${c.text}
        animate-slide-up
      `}
      role="alert"
    >
      <span className="text-lg flex-shrink-0 mt-0.5">{c.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{c.title}</p>
        <p className="text-sm opacity-80 mt-0.5">{c.message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded-lg hover:bg-black/5 transition-colors"
          aria-label="Dismiss error"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
