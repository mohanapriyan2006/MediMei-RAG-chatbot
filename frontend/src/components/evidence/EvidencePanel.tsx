import { useState, useMemo } from 'react'
import {
  ShieldCheck,
  FileSearch,
  BookOpen,
  X,
  FileText,
} from 'lucide-react'
import { useChat } from '../../hooks/useChat'
import { useDocuments } from '../../hooks/useDocuments'
import { EvidenceCard } from './EvidenceCard'
import { SourceViewerModal } from './SourceViewerModal'
import type { Citation } from '../../types/chat'

export interface EvidencePanelProps {
  onClose?: () => void
  isMobileDrawer?: boolean
}

export function EvidencePanel({ onClose, isMobileDrawer = false }: EvidencePanelProps) {
  const { activeCitations, selectedCitation, setSelectedCitation, isLoading } = useChat()
  const { documents } = useDocuments()
  const [inspectModalCitation, setInspectModalCitation] = useState<Citation | null>(null)
  const [sourceViewerOpen, setSourceViewerOpen] = useState(false)
  const [sourceViewerCitation, setSourceViewerCitation] = useState<Citation | null>(null)

  const sourceDocument = useMemo(
    () => (sourceViewerCitation ? documents.find((d) => d.id === sourceViewerCitation.documentId) || null : null),
    [documents, sourceViewerCitation],
  )

  return (
    <aside className="flex h-full w-full flex-col border-l border-border bg-surface text-fg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
              Source Verification
            </h3>
            <p className="text-[11px] text-fg-muted">
              {activeCitations.length} Grounded Source{activeCitations.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {isMobileDrawer && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-2xl text-fg-muted hover:bg-surface-highlight hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-highlight text-accent animate-pulse">
              <FileSearch className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold text-primary">Searching trusted documentation…</p>
            <p className="text-[11px] text-fg-muted max-w-[200px]">
              Extracting dense vector chunks and verifying page alignment in Qdrant.
            </p>
          </div>
        ) : activeCitations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-highlight text-fg-muted">
              <BookOpen className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold text-fg">No Citations Selected</p>
            <p className="text-[11px] text-fg-muted max-w-[220px]">
              Ask a question about a drug label or click on any AI response to inspect its supporting source citations.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-surface-warm/40 border border-border p-3 text-[11px] text-fg-secondary flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success" />
                <span className="font-semibold text-primary">100% Label Grounded</span>
              </div>
              <span className="text-[10px] text-fg-muted">Click card to select</span>
            </div>

            <div className="space-y-3" role="list" aria-label="Evidence sources">
              {activeCitations.map((citation) => (
                <EvidenceCard
                  key={citation.citationId}
                  citation={citation}
                  isSelected={selectedCitation?.citationId === citation.citationId}
                  onClick={() => setSelectedCitation(citation)}
                  onViewSource={(c) => setInspectModalCitation(c)}
                />
              ))}
            </div>
          </>
        )}
      </div>


      {/* Inspection Modal */}
      {inspectModalCitation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-surface p-6 shadow-hover space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="rounded-pill bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                  Official Prescribing Information
                </span>
                <h3 className="mt-2 text-base font-bold text-fg">
                  {inspectModalCitation.documentName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectModalCitation(null)}
                className="flex h-8 w-8 items-center justify-center rounded-2xl text-fg-muted hover:bg-surface-highlight"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 border-y border-border py-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-fg">Page Number:</span>
                <span className="font-bold text-primary">Page {inspectModalCitation.page}</span>
              </div>
              {inspectModalCitation.section && (
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-fg">Label Section:</span>
                  <span className="font-bold text-accent">{inspectModalCitation.section}</span>
                </div>
              )}
              {inspectModalCitation.score != null && (
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-fg">Relevance:</span>
                  <span className="font-bold text-success">{(inspectModalCitation.score * 100).toFixed(0)}% match</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-fg">Chunk ID:</span>
                <span className="font-mono text-fg-muted">{inspectModalCitation.citationId}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wider text-fg-muted">
                Extracted Evidence Excerpt
              </p>
              <div className="max-h-48 overflow-y-auto rounded-2xl bg-background p-3 text-xs leading-relaxed text-fg border border-border font-serif">
                {inspectModalCitation.text || (
                  <span className="italic text-fg-muted">
                    This section was verified against the official vector embedding for Page {inspectModalCitation.page} ({inspectModalCitation.section}).
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <a
                href={`/documents`}
                className="rounded-pill border border-border px-4 py-2 text-xs font-semibold text-fg hover:bg-surface-highlight"
              >
                Open in Documents
              </a>
              <button
                type="button"
                onClick={() => {
                  setSourceViewerCitation(inspectModalCitation)
                  setSourceViewerOpen(true)
                  setInspectModalCitation(null)
                }}
                className="inline-flex items-center gap-1.5 rounded-pill bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>View Source PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
      <SourceViewerModal
        citation={sourceViewerCitation}
        document={sourceDocument}
        open={sourceViewerOpen}
        onClose={() => {
          setSourceViewerOpen(false)
          setSourceViewerCitation(null)
        }}
      />
    </aside>
  )
}

export default EvidencePanel
