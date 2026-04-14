/**
 * TypingIndicator — three bouncing dots shown while waiting for the first token.
 */
export default function TypingIndicator() {
  return (
    <div id="typing-indicator" className="flex items-center gap-1.5 px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="flex items-center gap-1">
        <span
          className="w-2 h-2 bg-gcp-blue rounded-full animate-pulse-dot"
          style={{ animationDelay: '-0.32s' }}
        />
        <span
          className="w-2 h-2 bg-gcp-blue rounded-full animate-pulse-dot"
          style={{ animationDelay: '-0.16s' }}
        />
        <span
          className="w-2 h-2 bg-gcp-blue rounded-full animate-pulse-dot"
        />
      </div>
      <span className="text-xs text-gcp-gray-500 ml-2">Analysing...</span>
    </div>
  )
}
