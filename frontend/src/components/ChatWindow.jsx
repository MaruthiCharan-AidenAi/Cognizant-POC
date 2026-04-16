import { useState, useRef, useEffect, useCallback } from 'react'
import { useSSE } from '../hooks/useSSE'
import { apiFetch, apiUrl, generateSessionId } from '../utils/api'
import MessageBubble from './MessageBubble'
import TypingIndicator from './TypingIndicator'
import ErrorBanner from './ErrorBanner'

const DEFAULT_SUGGESTIONS = [
  'Which companies are furthest below their revenue target this quarter?',
  'Show actual revenue vs target by pod for the current quarter.',
  'Which pods have the lowest session completion rate right now?',
  'What is the revenue trend by quarter, and where did momentum change?',
]

/**
 * ChatWindow — full-height chat interface with SSE streaming.
 *
 * Props:
 *   - token: Google OAuth JWT credential
 *   - user: { email, name, picture, role, region } from backend/login
 *   - onSignOut: callback to sign out
 */
export default function ChatWindow({ token, user, onSignOut }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState(DEFAULT_SUGGESTIONS)
  const [error, setError] = useState(null)
  const [waitingForFirstToken, setWaitingForFirstToken] = useState(false)
  const [sessionId] = useState(() => generateSessionId())
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const currentAssistantIdRef = useRef(null)
  const { isStreaming, startStream, stopStream } = useSSE()

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, waitingForFirstToken, scrollToBottom])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    let active = true

    async function loadSuggestions() {
      if (!token) return
      try {
        const data = await apiFetch('/suggestions', { token })
        if (active && Array.isArray(data?.suggestions) && data.suggestions.length > 0) {
          setSuggestions(data.suggestions)
        }
      } catch (err) {
        if (active) {
          setSuggestions(DEFAULT_SUGGESTIONS)
        }
      }
    }

    loadSuggestions()
    return () => {
      active = false
    }
  }, [token])

  const handleSend = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return

    setError(null)

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')

    const assistantId = `assistant-${Date.now()}`
    currentAssistantIdRef.current = assistantId
    let assistantMsgAdded = false
    setWaitingForFirstToken(true)

    await startStream({
      url: apiUrl('/chat'),
      body: { message: trimmed, session_id: sessionId },
      token,
      onChunk: (data) => {
        if (data.type === 'token') {
          if (!assistantMsgAdded) {
            assistantMsgAdded = true
            setWaitingForFirstToken(false)
            setMessages((prev) => [
              ...prev,
              { id: assistantId, role: 'assistant', content: data.content, assumptions: [], confidence: null },
            ])
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + data.content } : m
              )
            )
          }
        } else if (data.type === 'confidence') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, confidence: { score: data.score, level: data.level } }
                : m
            )
          )
        } else if (data.type === 'assumption') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, assumptions: [...(m.assumptions || []), data.text] }
                : m
            )
          )
        }
      },
      onError: (err) => {
        setWaitingForFirstToken(false)
        setError(err)
        setMessages((prev) => prev.filter((m) => m.id !== assistantId))
      },
      onDone: () => {
        setWaitingForFirstToken(false)
      },
    })
  }, [input, isStreaming, sessionId, token, startStream])

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  return (
    <div className="chat-container bg-gcp-gray-50">
      {/* Header */}
      <header className="chat-header flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2.5 sm:py-3 bg-white border-b border-gcp-gray-200 shadow-sm">
        <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-xl bg-gradient-to-br from-gcp-blue to-gcp-blue-dark flex items-center justify-center">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm sm:text-base font-semibold text-gcp-gray-900 truncate">
            Analytics Assistant
          </h1>
          <p className="text-[11px] sm:text-xs text-gcp-gray-500 truncate">
            Signed in as {user?.name || user?.email || 'Unknown'}
          </p>
          {(user?.role || user?.region) && (
            <p className="text-[10px] sm:text-[11px] text-gcp-gray-500 truncate">
              Role: <span className="font-medium text-gcp-blue-dark">{user?.role || 'N/A'}</span>
              {user?.region ? ` • ${user.region}` : ''}
            </p>
          )}
        </div>

        {/* User avatar + sign out */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <span
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-gcp-green"
            title="Connected"
          >
            <span className="w-2 h-2 bg-gcp-green rounded-full animate-pulse" />
            Connected
          </span>
          <span className="sm:hidden w-2 h-2 bg-gcp-green rounded-full animate-pulse" title="Connected" />
          {user?.picture && (
            <img
              src={user.picture}
              alt={user.name}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-gcp-gray-200"
              referrerPolicy="no-referrer"
            />
          )}
          <button
            id="sign-out-button"
            onClick={onSignOut}
            className="text-[11px] sm:text-xs text-gcp-gray-500 hover:text-gcp-red transition-colors px-1.5 sm:px-2 py-1 rounded-lg hover:bg-gcp-red-light whitespace-nowrap"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Error Banner */}
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {/* Messages */}
      <div className="message-area">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gcp-blue/10 to-gcp-blue/5 flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-gcp-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gcp-gray-800 mb-2">
              Hello, {user?.name?.split(' ')[0] || 'there'}! 👋
            </h2>
            <p className="text-sm text-gcp-gray-500 max-w-md mb-8 leading-relaxed">
              Ask me anything about your analytics data. Your access is scoped
              to your role and region.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
              {suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  id={`suggestion-${i}`}
                  onClick={() => {
                    setInput(suggestion)
                    inputRef.current?.focus()
                  }}
                  className="text-left text-sm px-4 py-3 rounded-xl bg-white border border-gcp-gray-200 text-gcp-gray-600 hover:text-gcp-blue hover:border-gcp-blue/30 hover:bg-gcp-blue-light/50 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {waitingForFirstToken && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="input-bar">
        <div className="max-w-4xl mx-auto flex items-end gap-2 sm:gap-3">
          <div className="flex-1 min-w-0 relative">
            <textarea
              id="chat-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your analytics..."
              rows={1}
              disabled={isStreaming}
              className="w-full min-w-0 resize-none rounded-xl border border-gcp-gray-300 bg-gcp-gray-50 px-3 py-2.5 sm:px-4 sm:py-3 pr-11 sm:pr-12 text-base sm:text-sm text-gcp-gray-900 placeholder:text-gcp-gray-400 focus:outline-none focus:ring-2 focus:ring-gcp-blue/30 focus:border-gcp-blue disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              style={{ maxHeight: '120px' }}
              onInput={(e) => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
            />
          </div>

          {isStreaming ? (
            <button
              id="stop-button"
              onClick={stopStream}
              className="flex-shrink-0 w-11 h-11 sm:w-10 sm:h-10 rounded-xl bg-gcp-red text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm touch-manipulation"
              aria-label="Stop streaming"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
            </button>
          ) : (
            <button
              id="send-button"
              onClick={handleSend}
              disabled={!input.trim()}
              className="flex-shrink-0 w-11 h-11 sm:w-10 sm:h-10 rounded-xl bg-gcp-blue text-white flex items-center justify-center hover:bg-gcp-blue-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm touch-manipulation"
              aria-label="Send message"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
              </svg>
            </button>
          )}
        </div>
        
      </div>
    </div>
  )
}
