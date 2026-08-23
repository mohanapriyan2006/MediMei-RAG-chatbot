import { GitCompareArrows } from 'lucide-react'

interface CompareButtonProps {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
}

export function CompareButton({ onClick, disabled, loading }: CompareButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading}
      className="inline-flex items-center justify-center gap-2 rounded-pill bg-primary px-6 py-3 text-sm font-bold text-white shadow-subtle transition-all duration-200 hover:bg-primary-hover hover:shadow-card active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <>
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <span>Comparing...</span>
        </>
      ) : (
        <>
          <GitCompareArrows className="h-4 w-4" />
          <span>Compare</span>
        </>
      )}
    </button>
  )
}

export default CompareButton
