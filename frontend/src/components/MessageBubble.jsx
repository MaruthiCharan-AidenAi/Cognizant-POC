import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ConfidenceBadge from './ConfidenceBadge'
import ChartRenderer, { normalizeChartSpec } from './ChartRenderer'

/**
 * Pull a chart spec from ```chart` or from a chart-shaped ```json` block; strip those fences from markdown.
 */
function extractChartAndMarkdown(content) {
  const src = content || ''
  let spec = null
  let md = src

  const chartFence = src.match(/```chart\s*([\s\S]*?)```/i)
  if (chartFence?.[1]) {
    try {
      spec = normalizeChartSpec(JSON.parse(chartFence[1].trim()))
    } catch {
      spec = null
    }
    md = md.replace(/```chart\s*[\s\S]*?```/gi, '')
  }

  if (!spec) {
    const re = /```(?:json)?\s*([\s\S]*?)```/gi
    let m
    while ((m = re.exec(src)) !== null) {
      try {
        const candidate = normalizeChartSpec(JSON.parse(m[1].trim()))
        if (candidate) {
          spec = candidate
          md = md.replace(m[0], '')
          break
        }
      } catch {
        /* not JSON or not a chart */
      }
    }
  }

  return { spec, markdown: md.trim() }
}

/**
 * MessageBubble — renders a single chat message.
 * 
 * - User messages: right-aligned, dark background
 * - Assistant messages: left-aligned, light background
 * - Renders markdown with react-markdown
 * - Shows confidence badge and assumption flags
 */
export default function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  const { spec: chartSpec, markdown: markdownContent } = !isUser
    ? extractChartAndMarkdown(message.content)
    : { spec: null, markdown: message.content }

  return (
    <div
      id={`message-${message.id}`}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-2 sm:gap-3 mb-3 sm:mb-4 animate-slide-up`}
    >
      {/* Avatar for assistant */}
      {!isUser && (
        <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-gcp-blue to-gcp-blue-dark flex items-center justify-center mt-0.5 sm:mt-1">
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
      )}

      <div
        className={`
          min-w-0 max-w-[min(92vw,36rem)] sm:max-w-[80%] rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3
          ${isUser
            ? 'bg-gcp-gray-900 text-white rounded-br-md'
            : 'bg-white border border-gcp-gray-200 text-gcp-gray-800 rounded-bl-md shadow-sm'
          }
        `}
      >
        {/* Message content */}
        <div
          className={`prose prose-sm max-w-none overflow-x-auto ${isUser ? 'prose-invert' : ''}`}
        >
          {isUser ? (
            <p className="m-0 text-sm leading-relaxed">{message.content}</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Custom code block rendering
                code({ node, inline, className, children, ...props }) {
                  if (inline) {
                    return (
                      <code
                        className="bg-gcp-gray-100 text-gcp-blue-dark px-1.5 py-0.5 rounded text-xs font-mono"
                        {...props}
                      >
                        {children}
                      </code>
                    )
                  }
                  return (
                    <pre className="bg-gcp-gray-900 text-gcp-gray-100 rounded-lg p-3 overflow-x-auto text-xs my-2">
                      <code className="font-mono" {...props}>
                        {children}
                      </code>
                    </pre>
                  )
                },
                // Tables
                table({ children }) {
                  return (
                    <div className="overflow-x-auto my-2">
                      <table className="min-w-full text-xs border-collapse">
                        {children}
                      </table>
                    </div>
                  )
                },
                th({ children }) {
                  return (
                    <th className="border border-gcp-gray-200 bg-gcp-gray-50 px-2 py-1.5 text-left font-semibold text-gcp-gray-700">
                      {children}
                    </th>
                  )
                },
                td({ children }) {
                  return (
                    <td className="border border-gcp-gray-200 px-2 py-1.5 text-gcp-gray-600">
                      {children}
                    </td>
                  )
                },
                // Paragraphs
                p({ children }) {
                  return <p className="my-1.5 text-sm leading-relaxed">{children}</p>
                },
                // Bold
                strong({ children }) {
                  return <strong className="font-semibold text-gcp-gray-900">{children}</strong>
                },
                // Lists
                ul({ children }) {
                  return <ul className="my-1.5 pl-4 list-disc text-sm">{children}</ul>
                },
                ol({ children }) {
                  return <ol className="my-1.5 pl-4 list-decimal text-sm">{children}</ol>
                },
              }}
            >
              {markdownContent}
            </ReactMarkdown>
          )}
        </div>

        {!isUser && chartSpec && <ChartRenderer spec={chartSpec} />}

        {/* Assumptions */}
        {message.assumptions?.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gcp-gray-100">
            {message.assumptions.map((assumption, i) => (
              <p key={i} className="text-xs italic text-gcp-gray-500 flex items-start gap-1.5 mt-1">
                <span className="text-gcp-yellow flex-shrink-0">ⓘ</span>
                {assumption}
              </p>
            ))}
          </div>
        )}

        {/* Confidence badge */}
        {message.confidence && (
          <div className="mt-2 pt-2 border-t border-gcp-gray-100">
            <ConfidenceBadge score={message.confidence.score} level={message.confidence.level} />
          </div>
        )}
      </div>

      {/* Avatar for user */}
      {isUser && (
        <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gcp-green flex items-center justify-center mt-0.5 sm:mt-1">
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      )}
    </div>
  )
}
