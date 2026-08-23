import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import type { DocumentStatus as Status } from '../../types/document'

interface DocumentStatusProps {
  status: Status
  stage?: string
  progress?: number
  progressDetail?: string
}

const STAGE_LABELS: Record<string, string> = {
  extraction: 'Extracting text',
  saving_pages: 'Saving pages',
  chunking: 'Chunking text',
  embedding: 'Generating embeddings',
  indexing: 'Indexing vectors',
  completed: 'Ready',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

export function DocumentStatus({ status, stage, progress, progressDetail }: DocumentStatusProps) {
  if (status === 'ready') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Ready
      </span>
    )
  }

  if (status === 'processing') {
    const pct = Math.min(100, Math.max(0, progress || 0))
    return (
      <div className="flex flex-col gap-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
          {STAGE_LABELS[stage || ''] || 'Processing'}
          {pct > 0 && <span className="tabular-nums">{pct}%</span>}
        </span>
        {progressDetail && (
          <span className="text-[10px] text-fg-muted leading-tight">{progressDetail}</span>
        )}
        {pct > 0 && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-danger/10 px-2.5 py-1 text-xs font-medium text-danger">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      Failed
    </span>
  )
}











