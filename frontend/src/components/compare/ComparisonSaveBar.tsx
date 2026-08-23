import { useState } from 'react'
import { Bookmark, BookmarkCheck, Copy, Check, ArrowUp, Sparkles, FolderArchive } from 'lucide-react'
import { toast } from 'sonner'
import type { ComparisonResult } from '../../types/comparison'

interface ComparisonSaveBarProps {
  result: ComparisonResult
  isSaved: boolean
  onSave: () => void
  onOpenSavedPanel: () => void
  savedCount: number
}

export function ComparisonSaveBar({
  result,
  isSaved,
  onSave,
  onOpenSavedPanel,
  savedCount,
}: ComparisonSaveBarProps) {
  const [copied, setCopied] = useState(false)

  const handleCopySummary = async () => {
    try {
      const title = `${result.drug1.name} vs ${result.drug2.name} Comparison Report`
      const sections = result.attributes
        .map((attr) => {
          return `### ${attr.label}\n- **${result.drug1.name}**: ${attr.drug1.content}\n- **${result.drug2.name}**: ${attr.drug2.content}\n`
        })
        .join('\n')

      const fullText = `${title}\n\n${sections}`
      await navigator.clipboard.writeText(fullText)
      setCopied(true)
      toast.success('Comparison summary copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy summary')
    }
  }

  const handleScrollTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="rounded-3xl border border-border bg-surface p-4 sm:p-5 shadow-card transition-all duration-200 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left info */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-fg">
              {result.drug1.name} vs {result.drug2.name}
            </h4>
            <p className="text-xs text-fg-muted">
              {result.attributes.length} clinical sections verified against prescribing documents
            </p>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Copy Summary Button */}
          <button
            type="button"
            onClick={handleCopySummary}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-2 text-xs font-semibold text-fg hover:bg-surface-highlight hover:text-primary transition-all duration-150 active:scale-95"
            title="Copy formatted comparison text"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-success" />
                <span className="text-success font-bold">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-fg-muted" />
                <span>Copy Summary</span>
              </>
            )}
          </button>

          {/* View Saved Library Button */}
          <button
            type="button"
            onClick={onOpenSavedPanel}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-2 text-xs font-semibold text-fg hover:border-primary hover:text-primary transition-all duration-150 active:scale-95"
            title="Open saved comparisons side panel"
          >
            <FolderArchive className="h-3.5 w-3.5 text-accent" />
            <span>Saved ({savedCount})</span>
          </button>

          {/* Primary Save Button */}
          <button
            type="button"
            onClick={onSave}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold shadow-card transition-all duration-150 active:scale-95 ${
              isSaved
                ? 'bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25'
                : 'bg-primary text-white hover:bg-primary-hover'
            }`}
          >
            {isSaved ? (
              <>
                <BookmarkCheck className="h-4 w-4" />
                <span>Saved to Library</span>
              </>
            ) : (
              <>
                <Bookmark className="h-4 w-4" />
                <span>Save Comparison Response</span>
              </>
            )}
          </button>

          {/* Back to top */}
          <button
            type="button"
            onClick={handleScrollTop}
            aria-label="Scroll back to top"
            title="Scroll to top"
            className="flex h-8 w-8 items-center justify-center rounded-full text-fg-muted hover:bg-surface-highlight hover:text-fg transition-colors"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default ComparisonSaveBar
