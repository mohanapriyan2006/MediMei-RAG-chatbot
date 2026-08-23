import { AlertTriangle, Sparkles } from 'lucide-react'
import type { ComparisonCell as ComparisonCellType, ComparisonCitation } from '../../types/comparison'
import { ComparisonCitationBadge } from './ComparisonCitationBadge'
import { MarkdownResponse } from '../common/MarkdownResponse'

interface ComparisonCellProps {
  cell: ComparisonCellType
  onCitationClick?: (citation: ComparisonCitation) => void
}

export function ComparisonCell({ cell, onCitationClick }: ComparisonCellProps) {
  const isUnavailable =
    cell.status === 'unavailable' || (!cell.content && cell.citations.length === 0)
  const isWarning = cell.status === 'warning'
  const isHighlight = cell.status === 'highlight'

  return (
    <td
      className={`border-b border-border/60 px-4 py-4 align-top text-sm leading-relaxed transition-colors duration-150 ${
        isWarning
          ? 'bg-warning/5 border-l-2 border-l-warning/60'
          : isHighlight
            ? 'bg-primary/[0.03] border-l-2 border-l-primary/60'
            : ''
      }`}
    >
      {isUnavailable ? (
        <p className="italic text-fg-muted text-[13px] py-1">Not available in source document.</p>
      ) : (
        <div className="space-y-2.5">
          {isWarning && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>Warning</span>
            </div>
          )}
          {isHighlight && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
              <Sparkles className="h-3 w-3 shrink-0" />
              <span>Key Dosage</span>
            </div>
          )}

          <MarkdownResponse
            content={cell.content}
            citations={cell.citations}
            onCitationClick={(c) => onCitationClick?.(c as ComparisonCitation)}
            compact
          />

          {cell.citations.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-border/40">
              {cell.citations.map((c) => (
                <ComparisonCitationBadge
                  key={c.citationId}
                  citation={c}
                  onClick={onCitationClick}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </td>
  )
}

export default ComparisonCell
