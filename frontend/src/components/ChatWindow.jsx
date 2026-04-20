import { useState, useRef, useEffect, useCallback } from 'react'
import { useSSE } from '../hooks/useSSE'
import { apiFetch, apiUrl, generateSessionId } from '../utils/api'
import MessageBubble from './MessageBubble'
import SessionSidebar from './SessionSidebar'
import TypingIndicator from './TypingIndicator'
import ErrorBanner from './ErrorBanner'

const DEFAULT_SUGGESTIONS = [
  'Which companies are furthest below their revenue target this quarter?',
  'Show actual revenue vs target by pod for the current quarter.',
  'Which pods have the lowest session completion rate right now?',
  'What is the revenue trend by quarter, and where did momentum change?',
]

/**
 * ChatWindow — chat UI with session sidebar, history, and SSE streaming.
 */
export default function ChatWindow({ token, user, onSignOut }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState(DEFAULT_SUGGESTIONS)
  const [error, setError] = useState(null)
  const [waitingForFirstToken, setWaitingForFirstToken] = useState(false)
  const [sessionId, setSessionId] = useState(() => generateSessionId())
  const [sessions, setSessions] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchHits, setSearchHits] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const currentAssistantIdRef = useRef(null)
  const searchTimerRef = useRef(null)
  const sessionLoadSeqRef = useRef(0)
  const localMessageVersionRef = useRef(0)
  const activeSessionRef = useRef(sessionId)
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
    activeSessionRef.current = sessionId
  }, [sessionId])

  const refreshSessions = useCallback(async () => {
    if (!token) return
    try {
      const data = await apiFetch('/sessions', { token })
      setSessions(Array.isArray(data?.sessions) ? data.sessions : [])
    } catch {
      setSessions([])
    }
  }, [token])

  useEffect(() => {
    refreshSessions()
  }, [refreshSessions])

  const loadMessagesForSession = useCallback(
    async (sid) => {
      if (!token || !sid) return
      const thisSeq = ++sessionLoadSeqRef.current
      const localVersionAtStart = localMessageVersionRef.current
      try {
        const data = await apiFetch(`/sessions/${encodeURIComponent(sid)}/messages`, { token })
        if (
          thisSeq !== sessionLoadSeqRef.current ||
          activeSessionRef.current !== sid ||
          localMessageVersionRef.current !== localVersionAtStart
        ) {
          return
        }
        const mapped = (data.messages || []).map((m) => ({
          id: m.message_id,
          role: m.role,
          content: m.content,
          assumptions: [],
          confidence: null,
        }))
        setMessages(mapped)
      } catch {
        if (
          thisSeq !== sessionLoadSeqRef.current ||
          activeSessionRef.current !== sid ||
          localMessageVersionRef.current !== localVersionAtStart
        ) {
          return
        }
        setMessages([])
      }
    },
    [token]
  )

  useEffect(() => {
    loadMessagesForSession(sessionId)
  }, [sessionId, loadMessagesForSession])

  useEffect(() => {
    let active = true

    async function loadSuggestions() {
      if (!token) return
      try {
        const data = await apiFetch('/suggestions', { token })
        if (active && Array.isArray(data?.suggestions) && data.suggestions.length > 0) {
          setSuggestions(data.suggestions)
        }
      } catch {
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

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    const q = searchQuery.trim()
    if (!q || !token) {
      setSearchHits([])
      setSearchLoading(false)
      return
    }
    setSearchLoading(true)
    searchTimerRef.current = setTimeout(async () => {
      try {
        const data = await apiFetch(
          `/search/messages?q=${encodeURIComponent(q)}`,
          { token }
        )
        setSearchHits(Array.isArray(data?.hits) ? data.hits : [])
      } catch {
        setSearchHits([])
      } finally {
        setSearchLoading(false)
      }
    }, 380)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [searchQuery, token])

  const handleNewChat = useCallback(() => {
    stopStream()
    localMessageVersionRef.current += 1
    setSessionId(generateSessionId())
    setMessages([])
    setSearchQuery('')
    setSidebarOpen(false)
    inputRef.current?.focus()
  }, [stopStream])

  const handleSelectSession = useCallback(
    (id) => {
      stopStream()
      localMessageVersionRef.current += 1
      setSessionId(id)
      setSidebarOpen(false)
    },
    [stopStream]
  )

  const handleRenameSession = useCallback(
    async (id, title) => {
      if (!token) return
      try {
        await apiFetch(`/sessions/${encodeURIComponent(id)}`, {
          token,
          method: 'PATCH',
          body: { title },
        })
        await refreshSessions()
      } catch {
        /* ignore */
      }
    },
    [token, refreshSessions]
  )

  const handleOpenHit = useCallback(
    (hit) => {
      stopStream()
      setSearchQuery('')
      setSearchHits([])
      setSessionId(hit.session_id)
      setSidebarOpen(false)
    },
    [stopStream]
  )

  const activeTitle = sessions.find((s) => s.session_id === sessionId)?.title

  const handleSend = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return

    setError(null)

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    }
    localMessageVersionRef.current += 1
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
        refreshSessions()
      },
    })
  }, [input, isStreaming, sessionId, token, startStream, refreshSessions])

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
    <div className="flex h-[100dvh] max-h-[100dvh] min-h-0 w-full bg-gcp-gray-100">
      <SessionSidebar
        sessions={sessions}
        activeSessionId={sessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onRenameSession={handleRenameSession}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchHits={searchHits}
        searchLoading={searchLoading}
        onOpenHit={handleOpenHit}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-gradient-to-b from-gcp-gray-100 to-gcp-gray-50">
        <header className="flex-shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 bg-white border-b border-gcp-gray-200 pt-[max(0.625rem,env(safe-area-inset-top,0px))]">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="sm:hidden p-2 -ml-1 rounded-xl text-gcp-gray-600 hover:bg-gcp-gray-100"
            aria-label="Open chats"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </button>
          <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-xl bg-gradient-to-br from-gcp-blue to-gcp-blue-dark flex items-center justify-center">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm sm:text-base font-semibold text-gcp-gray-900 truncate tracking-tight">
              {activeTitle || 'Analytics Assistant'}
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

        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        <div className="message-area px-4 sm:px-8 py-5">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in px-2">
              <div className="w-16 h-16 rounded-2xl bg-white border border-gcp-gray-200 flex items-center justify-center mb-5 shadow-sm">
                <svg className="w-10 h-10 text-gcp-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gcp-gray-900 mb-2">
                Hello, {user?.name?.split(' ')[0] || 'there'}
              </h2>
              <p className="text-sm text-gcp-gray-600 max-w-md mb-8 leading-relaxed">
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
                    className="text-left text-sm px-4 py-3 rounded-xl bg-white border border-gcp-gray-200 text-gcp-gray-700 hover:text-gcp-blue-dark hover:border-gcp-blue/30 transition-colors duration-200 shadow-sm"
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

        <div className="input-bar bg-white border-t border-gcp-gray-200">
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
    </div>
  )
}
