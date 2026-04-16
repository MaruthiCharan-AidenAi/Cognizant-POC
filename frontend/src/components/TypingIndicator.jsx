/**
 * TypingIndicator — three bouncing dots shown while waiting for the first token.
 * Styled to match the assistant MessageBubble layout (avatar + bubble).
 */
export default function TypingIndicator() {
  return (
    <div id="typing-indicator" className="flex justify-start gap-2 sm:gap-3 mb-3 sm:mb-4 animate-slide-up">
      {/* Assistant avatar */}
      <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-gcp-blue to-gcp-blue-dark flex items-center justify-center mt-0.5 sm:mt-1">
        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>

      {/* Bubble */}
      <div className="bg-white border border-gcp-gray-200 text-gcp-gray-800 rounded-2xl rounded-bl-md shadow-sm px-3 py-2.5 sm:px-4 sm:py-3 flex items-center gap-1.5">
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
        <span className="text-xs text-gcp-gray-500 ml-1">Analysing...</span>
      </div>
    </div>
  )
}
