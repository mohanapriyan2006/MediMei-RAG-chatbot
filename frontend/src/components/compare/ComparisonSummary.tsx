import { AlertTriangle, GitCompareArrows, Layers, XCircle, Zap } from 'lucide-react'
import type { ComparisonResult, ComparisonSummary as SummaryType } from '../../types/comparison'

function deriveSummary(result: ComparisonResult): SummaryType {
  if (result.summary) {
    return result.summary
  }

  const attributes = result.attributes
  let warningCount = 0
  let highlightCount = 0
  let unavailableCount = 0
  let bothUnavailableCount = 0

  for (const attr of attributes) {
    for (const cell of [attr.drug1, attr.drug2]) {
      if (cell.status === 'warning') warningCount++
      if (cell.status === 'highlight') highlightCount++
      if (cell.status === 'unavailable') unavailableCount++
    }
    if (attr.drug1.status === 'unavailable' && attr.drug2.status === 'unavailable') {
      bothUnavailableCount++
    }
  }

  return {
    totalAttributes: attributes.length,
    warningCount,
    highlightCount,
    unavailableCount,
    bothUnavailableCount,
  }
}

interface StatItemProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  colorClass: string
}

function StatItem({ icon: Icon, label, value, colorClass }: StatItemProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4">
      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-xl bg-surface ${colorClass}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{label}</p>
        <p className="text-lg font-extrabold text-fg">{value}</p>
      </div>
    </div>
  )
}

export function ComparisonSummary({ result }: { result: ComparisonResult }) {
  const s = deriveSummary(result)

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-card animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-bold text-fg">Comparison summary</h3>
          <p className="mt-0.5 text-xs text-fg-muted">
            Side-by-side analysis across {s.totalAttributes} clinical sections
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:w-auto lg:grid-cols-5">
          <StatItem
            icon={Layers}
            label="Sections"
            value={s.totalAttributes}
            colorClass="text-primary"
          />
          <StatItem
            icon={AlertTriangle}
            label="Warnings"
            value={s.warningCount}
            colorClass="text-warning"
          />
          <StatItem
            icon={Zap}
            label="Highlights"
            value={s.highlightCount}
            colorClass="text-accent"
          />
          <StatItem
            icon={XCircle}
            label="Gaps"
            value={s.unavailableCount}
            colorClass="text-fg-muted"
          />
          <StatItem
            icon={GitCompareArrows}
            label="Both missing"
            value={s.bothUnavailableCount}
            colorClass="text-danger"
          />
        </div>
      </div>

      {s.bothUnavailableCount > 0 && (
        <div className="mt-4 rounded-lg border border-warning/20 bg-warning/5 px-3 py-2 text-xs text-warning">
          {s.bothUnavailableCount} section{s.bothUnavailableCount === 1 ? '' : 's'} had no information in either document.
        </div>
      )}
    </div>
  )
}

export default ComparisonSummary
