import { FileText, CheckCircle2 } from 'lucide-react'
import type { Citation } from '../../types/chat'
import { useChat } from '../../hooks/useChat'

interface CitationBadgeProps {
  citation: Citation
  onClick?: () => void
}

export function CitationBadge({ citation, onClick }: CitationBadgeProps) {
  const { setSelectedCitation, selectedCitation } = useChat()
  const isSelected = selectedCitation?.citationId === citation.citationId

  const docLabel = citation.documentName ? citation.documentName : 'Source Document'
  const truncatedDoc = docLabel.length > 20 ? `${docLabel.slice(0, 18)}…` : docLabel

  return (
    <button
      type="button"
      onClick={() => {
        setSelectedCitation(citation)
        onClick?.()
      }}
      className={`group inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-medium transition-all duration-200 shadow-xs cursor-pointer ${
        isSelected
          ? 'border-primary bg-primary text-white shadow-subtle'
          : 'border-border/80 bg-surface/90 text-fg hover:border-primary/60 hover:bg-primary/5 hover:text-primary'
      }`}
      aria-label={`Source: ${citation.documentName}, page ${citation.page}`}
      title={`${citation.documentName} — Page ${citation.page}${citation.section ? ` (${citation.section})` : ''}`}
    >
      <FileText className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-accent'}`} />
      <span className="font-semibold">{truncatedDoc}</span>
      <span className={`rounded-sm px-1.5 py-0.2 text-[10px] font-bold ${isSelected ? 'bg-white/20 text-white' : 'bg-surface-highlight text-primary'}`}>
        p.{citation.page}
      </span>
      {citation.section && (
        <span className={`max-w-[120px] truncate text-[10px] ${isSelected ? 'text-white/80' : 'text-fg-muted'}`}>
          • {citation.section}
        </span>
      )}
      <CheckCircle2 className={`h-3 w-3 shrink-0 ${isSelected ? 'text-emerald-300' : 'text-success'}`} />
    </button>
  )
}

export default CitationBadge
