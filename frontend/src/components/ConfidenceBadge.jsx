/**
 * ConfidenceBadge — renders a colored confidence score chip.
 * 
 * - 80-100: GREEN "HIGH 86"
 * - 60-79:  AMBER "MEDIUM 72"
 * - 0-59:   RED   "LOW 45"
 */
export default function ConfidenceBadge({ score, level }) {
  const config = {
    HIGH: {
      bg: 'bg-confidence-high-bg',
      text: 'text-confidence-high',
      border: 'border-confidence-high/20',
      icon: '✓',
    },
    MEDIUM: {
      bg: 'bg-confidence-medium-bg',
      text: 'text-confidence-medium',
      border: 'border-confidence-medium/20',
      icon: '⚠',
    },
    LOW: {
      bg: 'bg-confidence-low-bg',
      text: 'text-confidence-low',
      border: 'border-confidence-low/20',
      icon: '✕',
    },
  }

  const c = config[level] || config.MEDIUM

  return (
    <span
      id={`confidence-badge-${score}`}
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
        border ${c.bg} ${c.text} ${c.border}
        animate-fade-in
      `}
    >
      <span className="text-[10px]">{c.icon}</span>
      <span>{level}</span>
      <span className="font-mono">{score}</span>
    </span>
  )
}
