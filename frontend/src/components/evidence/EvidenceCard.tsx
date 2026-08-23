import { FileText, ArrowUpRight, BookOpen, CheckCircle, Sparkles } from 'lucide-react'
import type { Citation } from '../../types/chat'

export interface EvidenceCardProps {
  citation: Citation
  isSelected?: boolean
  onClick?: () => void
  onViewSource?: (citation: Citation) => void
}

export function EvidenceCard({
  citation,
  isSelected = false,
  onClick,
  onViewSource,
}: EvidenceCardProps) {
  return (
    <div
      onClick={onClick}
      className={`group cursor-pointer rounded-2xl border p-4 transition-all duration-200 ${
        isSelected
          ? 'border-primary bg-surface shadow-card ring-1 ring-primary/20'
          : 'border-border bg-background hover:border-accent/40 hover:bg-surface'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-fg truncate max-w-[170px]" title={citation.documentName}>
              {citation.documentName}
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              {citation.documentId === 'USER_MEMORY' ? (
                <span className="rounded-pill bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent inline-flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5" />
                  <span>User Memory</span>
                </span>
              ) : (
                <span className="rounded-pill bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  Page {citation.page}
                </span>
              )}
              {citation.score != null && (
                <span className="rounded-pill bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">
                  {(citation.score * 100).toFixed(0)}% match
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-fg-muted">
                <CheckCircle className="h-2.5 w-2.5" />
                <span>Verified</span>
              </span>
            </div>
          </div>
        </div>

        {onViewSource && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onViewSource(citation)
            }}
            className="flex h-6 w-6 items-center justify-center rounded-full text-fg-muted hover:bg-surface-highlight hover:text-primary transition-colors"
            title="Inspect source page"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {citation.section && (
        <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-accent">
          <BookOpen className="h-3 w-3 shrink-0" />
          <span className="truncate">{citation.section}</span>
        </div>
      )}

      {citation.text && (
        <p className="mt-2 text-xs leading-relaxed text-fg-secondary line-clamp-4 border-l-2 border-primary/20 pl-2.5 italic">
          "{citation.text}"
        </p>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-border/80 pt-2 text-[10px] text-fg-muted">
        <span className="font-mono">
          {citation.documentId === 'USER_MEMORY' ? 'Memory' : `Chunk #${citation.citationId.slice(-6)}`}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (onViewSource) onViewSource(citation)
          }}
          className="inline-flex items-center gap-1 font-bold text-accent hover:underline"
        >
          <ArrowUpRight className="h-3 w-3" />
          <span>View Source</span>
        </button>
      </div>
    </div>
  )
}

export default EvidenceCard
