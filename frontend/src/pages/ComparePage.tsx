import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, Loader2, Bookmark } from 'lucide-react'
import { ChatLayout } from '../components/layout/ChatLayout'
import { DrugSelector } from '../components/compare/DrugSelector'
import { ComparisonTable } from '../components/compare/ComparisonTable'
import { ComparisonEmptyState } from '../components/compare/ComparisonEmptyState'
import { ComparisonSkeleton } from '../components/compare/ComparisonSkeleton'
import { ComparisonError } from '../components/compare/ComparisonError'
import { ComparisonSummary } from '../components/compare/ComparisonSummary'
import { SavedComparisonsPanel } from '../components/compare/SavedComparisonsPanel'
import { ComparisonSaveBar } from '../components/compare/ComparisonSaveBar'
import { useDocuments } from '../hooks/useDocuments'
import { useChat } from '../hooks/useChat'
import { useUI } from '../hooks/useUI'
import { useTask } from '../hooks/useTask'
import { useSavedComparisons } from '../hooks/useSavedComparisons'
import { compareDrugs } from '../services/comparisonService'
import type { ComparisonResult, ComparisonCitation, SavedComparison } from '../types/comparison'
import type { CompareTaskPayload } from '../types/task'
import medicalDocumentsImage from '../assets/documents.png'

export default function ComparePage() {
  const { documents } = useDocuments()
  const { setSelectedCitation } = useChat()
  const { isMobile } = useUI()
  const { currentTask, startTask } = useTask()
  const {
    savedList,
    saveComparison,
    updateTitle,
    deleteComparison,
    isSaved,
  } = useSavedComparisons()

  const readyDocs = documents.filter((d) => d.status === 'ready')

  const [drug1Id, setDrug1Id] = useState<string | null>(null)
  const [drug2Id, setDrug2Id] = useState<string | null>(null)
  const [validationMsg, setValidationMsg] = useState<string | null>(null)

  const [savedPanelOpen, setSavedPanelOpen] = useState(false)
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null)

  const isComparing = currentTask.type === 'compare' && currentTask.status === 'running'
  const isTaskRunning = currentTask.status === 'running'
  const isBlocked = isTaskRunning && currentTask.type !== 'compare'

  const taskResult =
    !activeSavedId && currentTask.type === 'compare' && currentTask.status === 'success'
      ? (currentTask.result as ComparisonResult)
      : null

  const taskError =
    !activeSavedId && currentTask.type === 'compare' && currentTask.status === 'error'
      ? currentTask.error || 'Comparison failed.'
      : null

  const savedResult = activeSavedId
    ? savedList.find((s) => s.id === activeSavedId)?.result
    : null

  const result = savedResult || taskResult
  const error = activeSavedId ? null : taskError

  // Restore an in-progress or completed comparison from the global task state.
  useEffect(() => {
    if (currentTask.type === 'compare' && currentTask.payload && !activeSavedId) {
      const payload = (currentTask.payload as unknown) as CompareTaskPayload
      setDrug1Id(payload.drug1Id)
      setDrug2Id(payload.drug2Id)
      setValidationMsg(null)
    }
  }, [])

  const handleSwap = useCallback(() => {
    setActiveSavedId(null)
    setDrug1Id(drug2Id)
    setDrug2Id(drug1Id)
  }, [drug1Id, drug2Id])

  const handleCompare = useCallback(async () => {
    setValidationMsg(null)
    setActiveSavedId(null)

    if (!drug1Id) {
      setValidationMsg('Select the first drug.')
      return
    }
    if (!drug2Id) {
      setValidationMsg('Select the second drug.')
      return
    }
    if (drug1Id === drug2Id) {
      setValidationMsg('Select two different drugs to compare.')
      return
    }

    const started = await startTask('compare', { drug1Id, drug2Id }, async (signal) =>
      compareDrugs(drug1Id, drug2Id, signal),
    )
    if (!started) {
      setValidationMsg('Another task is in progress. Please wait or go to that page.')
    }
  }, [drug1Id, drug2Id, startTask])

  const handleCitationClick = useCallback(
    (citation: ComparisonCitation) => {
      setSelectedCitation(citation)
    },
    [setSelectedCitation],
  )

  const handleRetry = useCallback(() => {
    handleCompare()
  }, [handleCompare])

  const handleSaveCurrent = useCallback(() => {
    if (!result) return
    const saved = saveComparison(result)
    setActiveSavedId(saved.id)
  }, [result, saveComparison])

  const handleSelectSaved = useCallback(
    (saved: SavedComparison) => {
      setDrug1Id(saved.drug1Id)
      setDrug2Id(saved.drug2Id)
      setActiveSavedId(saved.id)
      setValidationMsg(null)
      if (isMobile) {
        setSavedPanelOpen(false)
      }
    },
    [isMobile],
  )

  const isCurrentResultSaved = result
    ? isSaved(result.drug1.id, result.drug2.id)
    : false

  return (
    <ChatLayout>
      <div className="flex h-full w-full overflow-hidden bg-background">
        {/* Main Comparison Column */}
        <div className="flex min-w-0 flex-1 flex-col h-full overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
            {/* Page Header Card */}
            <section className="pt-1 lg:pt-0">
              <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-4 shadow-card sm:p-6">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(15,119,114,0.1),transparent_45%)]" />

                {/* Subtle medicine illustration background */}
                <div className="absolute right-0 bottom-0 top-0 w-1/3 pointer-events-none select-none overflow-hidden hidden md:block">
                  <div className="absolute inset-0 bg-gradient-to-r from-surface to-transparent z-10 w-24" />
                  <img
                    src={medicalDocumentsImage}
                    alt=""
                    className="absolute right-4 bottom-2 h-full max-h-[140px] w-auto object-contain opacity-30"
                  />
                </div>

                <div className="relative z-20 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="max-w-xl space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Drug Comparison
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-2xl">
                      Compare medications
                    </h1>
                    <p className="text-xs sm:text-sm leading-relaxed text-fg-secondary">
                      Review clinical data side-by-side based on verified prescribing documents.
                    </p>
                  </div>

                  {/* Header Actions: Toggle Saved Comparisons Panel */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSavedPanelOpen((prev) => !prev)}
                      aria-label="Toggle Saved Comparisons Panel"
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition-all shadow-xs active:scale-95 ${
                        savedPanelOpen
                          ? 'border-primary bg-primary text-white shadow-subtle'
                          : 'border-border bg-surface text-fg hover:border-primary/60 hover:bg-primary/5 hover:text-primary'
                      }`}
                    >
                      <Bookmark className="h-3.5 w-3.5 text-accent" />
                      <span>Saved ({savedList.length})</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Blocked Task Alert */}
            {isBlocked && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-2.5 text-sm text-warning animate-fade-in"
              >
                <span className="font-semibold">
                  {currentTask.type === 'chat'
                    ? 'An AI chat is in progress. Wait or switch to the chat page.'
                    : currentTask.type === 'document'
                      ? 'A document is being processed. Wait or switch to documents.'
                      : 'Another task is in progress. Please wait.'}
                </span>
              </div>
            )}

            {/* Drug Selector */}
            <DrugSelector
              documents={readyDocs}
              drug1Id={drug1Id}
              drug2Id={drug2Id}
              onDrug1Change={(id) => {
                setActiveSavedId(null)
                setDrug1Id(id)
              }}
              onDrug2Change={(id) => {
                setActiveSavedId(null)
                setDrug2Id(id)
              }}
              onSwap={handleSwap}
              onCompare={handleCompare}
              loading={isTaskRunning}
            />

            {/* Validation message */}
            {validationMsg && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-2.5 text-sm text-warning animate-fade-in"
              >
                <span className="font-semibold">{validationMsg}</span>
              </div>
            )}

            {/* Results Area */}
            <section aria-live="polite" aria-busy={isComparing} className="space-y-5 pb-8">
              {isComparing ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Comparing drug information…</span>
                  </div>
                  <ComparisonSkeleton />
                </div>
              ) : error ? (
                <ComparisonError message={error} onRetry={handleRetry} />
              ) : result ? (
                <div className="space-y-5 animate-fade-in">
                  <ComparisonSummary result={result} />
                  {result.attributes.length > 0 ? (
                    <ComparisonTable result={result} onCitationClick={handleCitationClick} />
                  ) : (
                    <div className="rounded-xl border border-border bg-surface p-8 text-center shadow-card">
                      <h3 className="text-base font-bold text-fg">No comparable sections found</h3>
                      <p className="mt-2 text-sm text-fg-muted leading-relaxed">
                        Both documents were processed, but no overlapping clinical sections
                        (indications, dosage, warnings, etc.) were found in the indexed content.
                        This may happen if the documents are still being indexed, have poor text
                        extraction quality, or contain non-standard section layouts.
                      </p>
                      <p className="mt-3 text-xs text-fg-muted">
                        Try re-processing the documents or check extraction logs for OCR issues.
                      </p>
                    </div>
                  )}

                  {/* Bottom Save Action Bar */}
                  <ComparisonSaveBar
                    result={result}
                    isSaved={isCurrentResultSaved}
                    onSave={handleSaveCurrent}
                    onOpenSavedPanel={() => setSavedPanelOpen(true)}
                    savedCount={savedList.length}
                  />
                </div>
              ) : (
                <ComparisonEmptyState />
              )}
            </section>
          </div>
        </div>

        {/* Desktop Side Panel: Saved Comparisons */}
        {savedPanelOpen && (
          <div className="hidden xl:block w-80 2xl:w-96 shrink-0 h-full animate-fade-in">
            <SavedComparisonsPanel
              savedList={savedList}
              activeComparisonId={activeSavedId}
              onSelectComparison={handleSelectSaved}
              onUpdateTitle={updateTitle}
              onDeleteComparison={deleteComparison}
              onClose={() => setSavedPanelOpen(false)}
            />
          </div>
        )}

        {/* Mobile / Tablet Drawer Modal */}
        {savedPanelOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs xl:hidden animate-fade-in">
            <div className="h-full w-full max-w-md bg-surface shadow-2xl">
              <SavedComparisonsPanel
                savedList={savedList}
                activeComparisonId={activeSavedId}
                onSelectComparison={handleSelectSaved}
                onUpdateTitle={updateTitle}
                onDeleteComparison={deleteComparison}
                onClose={() => setSavedPanelOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Mobile quick trigger button when panel is closed and saved comparisons exist */}
        {isMobile && savedList.length > 0 && !savedPanelOpen && (
          <button
            type="button"
            onClick={() => setSavedPanelOpen(true)}
            aria-label={`View ${savedList.length} saved comparison${savedList.length === 1 ? '' : 's'}`}
            className="fixed right-0 top-1/2 z-30 -translate-y-1/2 rounded-l-2xl bg-primary px-2.5 py-3 text-white shadow-card transition-transform active:scale-95"
          >
            <div className="flex flex-col items-center gap-1">
              <Bookmark className="h-4 w-4" />
              <span className="text-[10px] font-bold">{savedList.length}</span>
            </div>
          </button>
        )}
      </div>
    </ChatLayout>
  )
}
