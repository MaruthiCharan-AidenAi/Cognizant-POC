import { useState, useCallback, useRef, useEffect } from 'react'

function formatRelativeTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * SessionSidebar — conversations list, semantic search, rename, new chat.
 */
export default function SessionSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onRenameSession,
  searchQuery,
  onSearchQueryChange,
  searchHits,
  searchLoading,
  onOpenHit,
  mobileOpen,
  onMobileClose,
}) {
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const renameInputRef = useRef(null)

  useEffect(() => {
    if (editingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [editingId])

  const startRename = useCallback((s) => {
    setEditingId(s.session_id)
    setEditValue(s.title || 'New chat')
  }, [])

  const commitRename = useCallback(() => {
    if (editingId && editValue.trim()) {
      onRenameSession(editingId, editValue.trim())
    }
    setEditingId(null)
    setEditValue('')
  }, [editingId, editValue, onRenameSession])

  const cancelRename = useCallback(() => {
    setEditingId(null)
    setEditValue('')
  }, [])

  const asideClass =
    'flex flex-col bg-white border-r border-gcp-gray-200 transition-transform duration-200 ease-out ' +
    'w-[min(100%,280px)] sm:w-72 shrink-0 ' +
    'fixed inset-y-0 left-0 z-40 shadow-xl sm:shadow-none sm:static sm:inset-auto ' +
    (mobileOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0')

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-gcp-gray-900/20 sm:hidden"
          aria-label="Close menu"
          onClick={onMobileClose}
        />
      )}
      <aside className={asideClass}>
        <div className="p-4 border-b border-gcp-gray-100 space-y-3 bg-white">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gcp-gray-500">
              Chats
            </span>
            <button
              type="button"
              onClick={onNewChat}
              className="text-xs font-medium text-gcp-blue hover:text-gcp-blue-dark px-2.5 py-1 rounded-lg hover:bg-gcp-blue-light/60"
            >
              + New
            </button>
          </div>
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gcp-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Search history (semantic)…"
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-gcp-gray-200 bg-gcp-gray-50 text-sm text-gcp-gray-800 placeholder:text-gcp-gray-400 focus:outline-none focus:ring-2 focus:ring-gcp-blue/20 focus:border-gcp-blue"
            />
            {searchLoading && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-gcp-blue/20 border-t-gcp-blue rounded-full animate-spin" />
            )}
          </div>
        </div>

        {searchQuery.trim() && (
          <div className="max-h-56 overflow-y-auto border-b border-gcp-gray-100 bg-gcp-gray-50/80">
            {searchHits.length === 0 && !searchLoading ? (
              <p className="px-3 py-4 text-xs text-gcp-gray-500 text-center">No matches</p>
            ) : (
              <ul className="py-1">
                {searchHits.map((h) => (
                  <li key={`${h.session_id}-${h.message_id}`}>
                    <button
                      type="button"
                      onClick={() => onOpenHit(h)}
                      className="w-full text-left px-3 py-2.5 hover:bg-white transition-colors"
                    >
                      <p className="text-xs font-medium text-gcp-gray-800 truncate">
                        {h.session_title || 'Chat'}
                      </p>
                      <p className="text-[11px] text-gcp-gray-500 line-clamp-2 mt-0.5">
                        {h.content}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <nav className="flex-1 min-h-0 overflow-y-auto py-2.5 bg-white">
          {sessions.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gcp-gray-500">
              No saved chats yet. Send a message to create one.
            </p>
          ) : (
            <ul className="space-y-1 px-2.5">
              {sessions.map((s) => {
                const active = s.session_id === activeSessionId
                return (
                  <li key={s.session_id}>
                    {editingId === s.session_id ? (
                      <div className="px-2 py-1">
                        <input
                          ref={renameInputRef}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename()
                            if (e.key === 'Escape') cancelRename()
                          }}
                          onBlur={commitRename}
                          className="w-full text-sm px-2 py-1.5 rounded-lg border border-gcp-blue bg-white"
                        />
                      </div>
                    ) : (
                      <div
                        className={`group flex items-center gap-1 rounded-lg px-2.5 py-2 transition-colors ${
                          active ? 'bg-gcp-blue-light/70 ring-1 ring-gcp-blue/15' : 'hover:bg-gcp-gray-100'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectSession(s.session_id)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <span
                            className={`text-sm font-medium truncate block ${
                              active ? 'text-gcp-blue-dark' : 'text-gcp-gray-800'
                            }`}
                          >
                            {s.title || 'New chat'}
                          </span>
                          <span className="text-[10px] text-gcp-gray-500 mt-0.5 block">
                            {formatRelativeTime(s.updated_at)}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => startRename(s)}
                          className="opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 rounded-lg text-gcp-gray-400 hover:text-gcp-blue hover:bg-white/80"
                          title="Rename"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </nav>
      </aside>
    </>
  )
}
