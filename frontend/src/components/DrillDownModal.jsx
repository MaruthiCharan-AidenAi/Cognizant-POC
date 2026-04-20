import { useState, useEffect, useMemo, useRef } from 'react'
import { apiUrl } from '../utils/api'
import ChartRenderer, { normalizeChartSpec } from './ChartRenderer'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ── Parsing ──────────────────────────────────────────────────────────────

function extractChartsAndMarkdown(src) {
  let md = src || ''
  const specs = []

  for (const m of [...md.matchAll(/```chart\s*([\s\S]*?)```/gi)]) {
    try {
      const spec = normalizeChartSpec(JSON.parse(m[1].trim()))
      if (spec) specs.push(spec)
    } catch { /* skip */ }
  }
  md = md.replace(/```chart\s*[\s\S]*?```/gi, '')

  if (specs.length === 0) {
    const re = /```(?:json)?\s*([\s\S]*?)```/gi
    let m
    while ((m = re.exec(src)) !== null) {
      try {
        const spec = normalizeChartSpec(JSON.parse(m[1].trim()))
        if (spec) { specs.push(spec); md = md.replace(m[0], '') }
      } catch { /* skip */ }
    }
  }

  return { specs, markdown: md.trim() }
}

function isMeaningfulTableRow(row) {
  if (!row || typeof row !== 'object') return false
  const values = Object.values(row)
  return values.some((v) => typeof v === 'number' && Number.isFinite(v)) ||
    values.some((v) => typeof v === 'string' && v.trim() && !['n/a', 'null', 'undefined', '-'].includes(v.trim().toLowerCase()))
}

function collectTableData(specs) {
  if (!specs.length) return { columns: [], rows: [] }
  const rowMap = new Map()
  for (const spec of specs) {
    for (const row of spec.data || []) {
      if (!isMeaningfulTableRow(row)) continue
      const keyVal =
        Object.values(row).find((v) => typeof v === 'string' && v.trim()) ??
        JSON.stringify(row)
      rowMap.set(keyVal, { ...(rowMap.get(keyVal) || {}), ...row })
    }
  }
  const rows = [...rowMap.values()].filter(isMeaningfulTableRow)
  if (!rows.length) return { columns: [], rows: [] }
  return { columns: Object.keys(rows[0]), rows }
}

function buildDrillQuery({ chartTitle, clickedLabel, clickedValue, filters }) {
  const filterParts = Object.entries(filters || {}).map(([k, v]) => `${k}="${v}"`).join(', ')
  const filterStr = filterParts ? ` with filters: ${filterParts}` : ''
  const valueStr = clickedValue != null ? ` (value: ${clickedValue})` : ''
  return (
    `Drill down into "${clickedLabel}"${valueStr} from chart "${chartTitle}"${filterStr}. ` +
    `Show a focused breakdown with charts and key insights. Include the underlying data rows.`
  )
}

// ── Sub-components ───────────────────────────────────────────────────────

function TabButton({ active, onClick, icon, label, badge }) {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all duration-150
        border-b-2 whitespace-nowrap
        ${active
          ? 'border-gcp-blue text-gcp-blue'
          : 'border-transparent text-gcp-gray-500 hover:text-gcp-gray-700 hover:border-gcp-gray-300'
        }
      `}
    >
      {icon}
      {label}
      {badge != null && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${active ? 'bg-gcp-blue/10 text-gcp-blue' : 'bg-gcp-gray-100 text-gcp-gray-500'}`}>
          {badge}
        </span>
      )}
    </button>
  )
}

function LoadingBlock({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-gcp-gray-200/80 ${className}`} />
}

function StreamingLoadingState({ label }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-gcp-blue/10 bg-gcp-blue/5 px-4 py-3">
        <span className="w-5 h-5 rounded-full border-2 border-gcp-blue border-t-transparent animate-spin flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-gcp-gray-700">Analyzing{label ? ` "${label}"` : ''}…</p>
          <p className="text-xs text-gcp-gray-500 mt-0.5">Building breakdown with charts and data.</p>
        </div>
      </div>
      <div className="rounded-xl border border-gcp-gray-100 bg-white p-4 space-y-3">
        <LoadingBlock className="h-4 w-40" />
        <LoadingBlock className="h-3 w-full" />
        <LoadingBlock className="h-3 w-11/12" />
        <LoadingBlock className="h-3 w-8/12" />
      </div>
      {[0, 1].map((idx) => (
        <div key={idx} className="rounded-xl border border-gcp-gray-100 bg-gcp-gray-50 p-3 space-y-3">
          <LoadingBlock className="h-4 w-48" />
          <LoadingBlock className="h-56 w-full rounded-xl" />
        </div>
      ))}
    </div>
  )
}

function DataTable({ columns, rows }) {
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 10

  function toggleSort(col) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir('asc') }
    setPage(0)
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((row) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)))
  }, [rows, search])

  const sorted = useMemo(() => {
    if (!sortCol) return filtered
    return [...filtered].sort((a, b) => {
      const av = a[sortCol] ?? '', bv = b[sortCol] ?? ''
      const isNum = typeof av === 'number' && typeof bv === 'number'
      const cmp = isNum ? av - bv : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortCol, sortDir])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function fmtValue(v) {
    if (v == null) return <span className="text-gcp-gray-300">—</span>
    if (typeof v === 'number') return v % 1 === 0 ? v.toLocaleString() : v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })
    return String(v)
  }

  function isNumericCol(col) { return rows.some((r) => typeof r[col] === 'number') }

  if (!columns.length) return (
    <div className="flex items-center justify-center py-12 text-sm text-gcp-gray-400">No table data available.</div>
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gcp-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          placeholder="Search rows…"
          className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gcp-gray-200 bg-gcp-gray-50 text-gcp-gray-800 placeholder:text-gcp-gray-400 focus:outline-none focus:ring-2 focus:ring-gcp-blue/30 focus:border-gcp-blue"
        />
      </div>
      <p className="text-xs text-gcp-gray-400">{filtered.length} row{filtered.length !== 1 ? 's' : ''}{search && ` matching "${search}"`}</p>
      <div className="overflow-x-auto rounded-xl border border-gcp-gray-200">
        <table className="min-w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gcp-gray-50 border-b border-gcp-gray-200">
              {columns.map((col) => (
                <th key={col} onClick={() => toggleSort(col)}
                  className={`px-3 py-2.5 text-left font-semibold text-gcp-gray-600 cursor-pointer select-none whitespace-nowrap hover:bg-gcp-gray-100 transition-colors ${isNumericCol(col) ? 'text-right' : ''}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.replace(/_/g, ' ')}
                    {sortCol === col
                      ? <span className="text-gcp-blue">{sortDir === 'asc' ? '↑' : '↓'}</span>
                      : <span className="text-gcp-gray-300">↕</span>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, ri) => (
              <tr key={ri} className={`border-b border-gcp-gray-100 transition-colors hover:bg-gcp-blue/5 ${ri % 2 === 0 ? 'bg-white' : 'bg-gcp-gray-50/50'}`}>
                {columns.map((col) => (
                  <td key={col} className={`px-3 py-2 text-gcp-gray-700 ${isNumericCol(col) ? 'text-right font-mono tabular-nums' : ''}`}>
                    {fmtValue(row[col])}
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-gcp-gray-400">No rows match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-gcp-gray-500">
          <span>Page {page + 1} of {totalPages}</span>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
              className="px-2.5 py-1 rounded-lg border border-gcp-gray-200 hover:bg-gcp-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">← Prev</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pageNum = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i
              return (
                <button key={pageNum} onClick={() => setPage(pageNum)}
                  className={`w-7 h-7 rounded-lg border text-xs transition-colors ${pageNum === page ? 'border-gcp-blue bg-gcp-blue text-white' : 'border-gcp-gray-200 hover:bg-gcp-gray-100'}`}>
                  {pageNum + 1}
                </button>
              )
            })}
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
              className="px-2.5 py-1 rounded-lg border border-gcp-gray-200 hover:bg-gcp-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next →</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Streaming fetch (SSE, character-level) ───────────────────────────────

async function streamDrillDown({ drillCtx, token, sessionId, onToken, onConfidence, onAssumption, onDone, onError, signal }) {
  const message = buildDrillQuery(drillCtx)

  let res
  try {
    res = await fetch(apiUrl('/drill-down'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        message,
        session_id: sessionId,
        drill_context: {
          chart_title: drillCtx.chartTitle,
          clicked_label: drillCtx.clickedLabel,
          clicked_value: drillCtx.clickedValue,
          filters: drillCtx.filters || {},
          original_chart_type: drillCtx.originalSpec?.type,
        },
      }),
      signal,
    })
  } catch (err) {
    if (err.name !== 'AbortError') onError(err.message || 'Network error')
    return
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    onError(err.detail || `Request failed (${res.status})`)
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        const dataStr = trimmed.slice(5).trim()
        if (dataStr === '[DONE]') continue

        try {
          const data = JSON.parse(dataStr)
          if (data.type === 'token') onToken(data.content || '')
          else if (data.type === 'confidence') onConfidence({ score: data.score, level: data.level })
          else if (data.type === 'assumption') onAssumption(data.text || '')
          else if (data.type === 'done') { onDone(); return }
          else if (data.type === 'error') { onError(data.detail || 'Stream error'); return }
        } catch { /* skip non-JSON */ }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') onError(err.message || 'Stream read error')
  }

  onDone()
}

// ── Main Modal ───────────────────────────────────────────────────────────

export default function DrillDownModal({ open, onClose, drillCtx, token, sessionId }) {
  const [text, setText] = useState('')
  const [confidence, setConfidence] = useState(null)
  const [assumptions, setAssumptions] = useState([])
  const [streaming, setStreaming] = useState(false)
  const [streamError, setStreamError] = useState(null)
  const [activeTab, setActiveTab] = useState('charts')
  const abortRef = useRef(null)

  useEffect(() => {
    if (!open || !drillCtx) return

    // Cancel any prior stream
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setText('')
    setConfidence(null)
    setAssumptions([])
    setStreamError(null)
    setStreaming(true)
    setActiveTab('charts')

    streamDrillDown({
      drillCtx,
      token,
      sessionId,
      signal: ctrl.signal,
      onToken: (chunk) => setText((prev) => prev + chunk),
      onConfidence: setConfidence,
      onAssumption: (t) => setAssumptions((prev) => [...prev, t]),
      onDone: () => setStreaming(false),
      onError: (msg) => { setStreamError(msg); setStreaming(false) },
    })

    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, drillCtx])

  const { specs, markdown } = useMemo(() => extractChartsAndMarkdown(text), [text])
  const { columns, rows } = useMemo(() => collectTableData(specs), [specs])

  if (!open) return null

  const isLoading = streaming && !text

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[88vh] flex flex-col bg-white sm:rounded-2xl shadow-2xl border-0 sm:border border-gcp-gray-200 overflow-hidden rounded-t-2xl">

        {/* ── Header ── */}
        <div className="flex items-start gap-3 px-5 pt-4 pb-3 bg-white border-b border-gcp-gray-100 flex-shrink-0">
          <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-gcp-blue/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-gcp-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gcp-gray-400 mb-0.5">Drill-down</p>
            <h2 className="text-sm font-semibold text-gcp-gray-900 leading-snug">
              {drillCtx?.chartTitle || 'Detail View'}
            </h2>
            {drillCtx?.clickedLabel && (
              <p className="text-xs text-gcp-gray-500 mt-0.5 flex items-center gap-1">
                <span className="text-gcp-gray-300">→</span>
                <span className="text-gcp-blue font-medium">{drillCtx.clickedLabel}</span>
                {drillCtx.clickedValue != null && (
                  <span className="text-gcp-gray-400 font-mono">
                    ({typeof drillCtx.clickedValue === 'number' ? drillCtx.clickedValue.toLocaleString() : drillCtx.clickedValue})
                  </span>
                )}
              </p>
            )}
          </div>

          <button onClick={onClose}
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-gcp-gray-400 hover:bg-gcp-gray-100 hover:text-gcp-gray-700 transition-colors"
            aria-label="Close">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Filter pills ── */}
        {drillCtx?.filters && Object.keys(drillCtx.filters).length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-5 py-2 border-b border-gcp-gray-100 bg-gcp-gray-50/60 flex-shrink-0">
            <span className="text-[10px] text-gcp-gray-400 self-center mr-1 font-medium uppercase tracking-wide">Filters:</span>
            {Object.entries(drillCtx.filters).map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-gcp-blue/10 text-gcp-blue border border-gcp-blue/20">
                <span className="text-gcp-gray-500 font-normal">{k.replace(/_/g, ' ')}:</span>
                <span className="font-medium">{String(v)}</span>
              </span>
            ))}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex border-b border-gcp-gray-200 bg-white px-2 flex-shrink-0 gap-1">
          <TabButton active={activeTab === 'charts'} onClick={() => setActiveTab('charts')} label="Charts & Analysis"
            badge={specs.length > 0 ? specs.length : undefined}
            icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
          />
          <TabButton active={activeTab === 'table'} onClick={() => setActiveTab('table')} label="Data Table"
            badge={rows.length > 0 ? rows.length : undefined}
            icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M10 3v18M6 3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6a3 3 0 013-3z" /></svg>}
          />
        </div>

        {/* ── Tab content ── */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* Charts & Analysis tab */}
          {activeTab === 'charts' && (
            <div className="px-5 py-4 space-y-5">
              {isLoading && <StreamingLoadingState label={drillCtx?.clickedLabel} />}

              {streamError && (
                <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-700">{streamError}</p>
                </div>
              )}

              {!isLoading && !streamError && !text && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-gcp-gray-500 font-medium">No analysis returned</p>
                  <p className="text-xs text-gcp-gray-400 mt-1 max-w-xs">The drill-down request finished without chart or narrative content.</p>
                </div>
              )}

              {markdown && (
                <div className="prose prose-sm max-w-none text-gcp-gray-800">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table({ children }) {
                        return (
                          <div className="my-3 overflow-x-auto rounded-xl border border-gcp-gray-200 shadow-sm">
                            <table className="min-w-full text-xs border-collapse">{children}</table>
                          </div>
                        )
                      },
                      thead({ children }) { return <thead className="bg-gcp-gray-50 border-b border-gcp-gray-200">{children}</thead> },
                      tbody({ children }) { return <tbody className="divide-y divide-gcp-gray-100">{children}</tbody> },
                      tr({ children, ...props }) {
                        return <tr className="hover:bg-gcp-blue/5 transition-colors even:bg-gcp-gray-50/50" {...props}>{children}</tr>
                      },
                      th({ children }) {
                        return <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gcp-gray-600 whitespace-nowrap tracking-wide uppercase">{String(children ?? '').replace(/_/g, ' ')}</th>
                      },
                      td({ children }) {
                        const raw = String(children ?? '')
                        const isNum = raw !== '' && !Number.isNaN(Number(raw))
                        return <td className={`px-3 py-2 text-gcp-gray-700 whitespace-nowrap ${isNum ? 'text-right font-mono tabular-nums' : ''}`}>{isNum ? Number(raw).toLocaleString() : children}</td>
                      },
                      p({ children }) { return <p className="my-1.5 text-sm leading-relaxed">{children}</p> },
                      strong({ children }) { return <strong className="font-semibold text-gcp-gray-900">{children}</strong> },
                      ul({ children }) { return <ul className="my-1.5 pl-4 list-disc text-sm">{children}</ul> },
                      ol({ children }) { return <ol className="my-1.5 pl-4 list-decimal text-sm">{children}</ol> },
                    }}
                  >
                    {markdown}
                  </ReactMarkdown>
                  {/* Streaming cursor */}
                  {streaming && <span className="inline-block w-0.5 h-4 bg-gcp-blue animate-pulse ml-0.5 align-middle" />}
                </div>
              )}

              {assumptions.length > 0 && (
                <div className="rounded-xl border border-gcp-yellow/30 bg-yellow-50/60 px-4 py-3 space-y-1">
                  {assumptions.map((a, i) => (
                    <p key={i} className="text-xs text-gcp-gray-600 flex items-start gap-1.5">
                      <span className="text-yellow-500 flex-shrink-0">ⓘ</span>{a}
                    </p>
                  ))}
                </div>
              )}

              {confidence && (
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${confidence.level === 'HIGH' ? 'bg-green-100 text-green-700' : confidence.level === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                    {confidence.level} confidence
                  </span>
                  <span className="text-xs text-gcp-gray-400">{confidence.score}/100</span>
                </div>
              )}

              {specs.map((spec, i) => (
                <div key={i} className="rounded-xl border border-gcp-gray-100 overflow-hidden">
                  <ChartRenderer spec={spec} />
                </div>
              ))}
            </div>
          )}

          {/* Data Table tab */}
          {activeTab === 'table' && (
            <div className="px-5 py-4">
              {streaming && !rows.length && (
                <div className="flex items-center gap-3 rounded-xl border border-gcp-blue/10 bg-gcp-blue/5 px-4 py-3">
                  <span className="w-5 h-5 rounded-full border-2 border-gcp-blue border-t-transparent animate-spin flex-shrink-0" />
                  <p className="text-sm font-medium text-gcp-gray-700">Table will appear once data loads…</p>
                </div>
              )}

              {!streaming && rows.length === 0 && !streamError && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-gcp-gray-500 font-medium">No table data</p>
                  <p className="text-xs text-gcp-gray-400 mt-1 max-w-xs">Table data is extracted from chart data in the analysis.</p>
                  <button onClick={() => setActiveTab('charts')}
                    className="mt-4 text-xs px-3 py-1.5 rounded-lg bg-gcp-blue/10 text-gcp-blue hover:bg-gcp-blue/20 transition-colors font-medium">
                    Go to Charts & Analysis →
                  </button>
                </div>
              )}

              {rows.length > 0 && <DataTable columns={columns} rows={rows} />}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3 border-t border-gcp-gray-100 bg-gcp-gray-50/80 flex justify-between items-center flex-shrink-0 gap-3">
          <div className="flex items-center gap-2 text-xs text-gcp-gray-400 min-w-0">
            {streaming && (
              <span className="inline-flex items-center gap-1.5 text-gcp-blue">
                <span className="w-1.5 h-1.5 rounded-full bg-gcp-blue animate-pulse" />
                Streaming…
              </span>
            )}
            {!streaming && specs.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                {specs.length} chart{specs.length !== 1 ? 's' : ''}
              </span>
            )}
            {rows.length > 0 && (
              <>
                <span className="text-gcp-gray-200">•</span>
                <span>{rows.length} row{rows.length !== 1 ? 's' : ''}</span>
              </>
            )}
          </div>
          <button onClick={onClose}
            className="flex-shrink-0 text-xs px-4 py-1.5 rounded-lg bg-gcp-gray-200 text-gcp-gray-700 hover:bg-gcp-gray-300 transition-colors font-medium">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
