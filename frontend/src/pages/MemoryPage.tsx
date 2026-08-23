import { useCallback, useEffect, useState } from 'react'
import {
  Brain,
  Trash2,
  Plus,
  Search,
  Info,
  Loader2,
  Trash,
  Check,
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { ChatLayout } from '../components/layout/ChatLayout'
import { useAuth } from '../contexts/AuthContext'
import {
  getMemoriesRequest,
  createMemoryRequest,
  deleteMemoryRequest,
  clearMemoriesRequest,
  toggleMemoryRequest,
} from '../api/memories'
import type { UserMemory } from '../api/memories'
import { MarkdownResponse } from '../components/common/MarkdownResponse'
import { DeleteConfirmModal } from '../components/common/DeleteConfirmModal'
import { toast } from 'sonner'

interface MemoryCitation {
  document_id?: string
  document_name?: string
  page_no?: number
  page?: number
  section_title?: string
  section?: string
  text?: string
}

interface ParsedQA {
  isQA: true
  question: string
  answer: string
  citations: MemoryCitation[]
}

interface ParsedPlain {
  isQA: false
  content: string
}

type ParsedMemory = ParsedQA | ParsedPlain

function parseMemoryContent(content: string): ParsedMemory {
  if (content.startsWith('Q: ') && content.includes(' | A: ')) {
    const qIndex = 3
    const aIndex = content.indexOf(' | A: ')
    const question = content.substring(qIndex, aIndex).trim()
    const rest = content.substring(aIndex + 6).trim()

    const cIndex = rest.indexOf(' | Citations: ')
    if (cIndex !== -1) {
      const answer = rest.substring(0, cIndex).trim()
      const citationsJson = rest.substring(cIndex + 14).trim()
      try {
        const citations = JSON.parse(citationsJson)
        return { isQA: true, question, answer, citations: Array.isArray(citations) ? citations : [] }
      } catch {
        return { isQA: true, question, answer, citations: [] }
      }
    } else {
      return { isQA: true, question, answer: rest, citations: [] }
    }
  }
  return { isQA: false, content }
}

/**
 * Individual Memory Card with Collapsible / Expandable Details
 */
function MemoryItemCard({
  memory,
  onDelete,
}: {
  memory: UserMemory
  onDelete: (memory: UserMemory) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const parsed = parseMemoryContent(memory.content)

  // Determine if content is long enough to warrant a show full toggle
  const isLongContent = parsed.isQA
    ? parsed.answer.length > 160 || (parsed.citations && parsed.citations.length > 2)
    : (parsed as ParsedPlain).content.length > 160

  const mappedCitations = parsed.isQA
    ? (parsed.citations || []).map((c, idx) => ({
        citationId: `S${idx + 1}`,
        documentId: c.document_id || '',
        documentName: c.document_name || 'Document',
        page: c.page_no ?? c.page ?? 1,
        section: c.section_title || c.section,
        text: c.text,
      }))
    : []

  return (
    <div className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 hover:shadow-subtle hover:border-primary/30 transition-all duration-200 animate-fade-in-up">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {parsed.isQA ? (
            <div className="space-y-2.5">
              {/* Question Header */}
              <div className="flex items-start gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary shrink-0 mt-0.5">
                  Q
                </span>
                <h4 className="text-xs font-bold text-fg leading-relaxed break-words">
                  {parsed.question}
                </h4>
              </div>

              {/* Answer Body (Clipped by default, expandable) */}
              <div className="pl-6 border-l-2 border-border/70">
                <div className={`relative transition-all duration-200 ${!expanded && isLongContent ? 'max-h-20 overflow-hidden' : ''}`}>
                  <MarkdownResponse
                    content={parsed.answer}
                    citations={mappedCitations}
                    compact
                  />
                  {/* Subtle fade gradient when clipped */}
                  {!expanded && isLongContent && (
                    <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface via-surface/80 to-transparent pointer-events-none" />
                  )}
                </div>
              </div>

              {/* Citations Badges */}
              {mappedCitations.length > 0 && (
                <div className="pl-6 pt-1">
                  <div className="flex flex-wrap gap-1.5">
                    {(expanded ? mappedCitations : mappedCitations.slice(0, 3)).map((c, cIdx) => (
                      <span
                        key={cIdx}
                        title={c.text || `${c.documentName} (p. ${c.page})`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-surface-highlight/80 px-2.5 py-0.5 text-[10px] font-medium text-fg-muted border border-border/80 shadow-2xs"
                      >
                        <FileText className="h-3 w-3 text-accent shrink-0" />
                        <span className="truncate max-w-[130px]">{c.documentName}</span>
                        <span className="opacity-70 text-[9px] font-semibold text-primary">
                          (p. {c.page})
                        </span>
                      </span>
                    ))}
                    {!expanded && mappedCitations.length > 3 && (
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        +{mappedCitations.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Expand / Collapse Button */}
              {isLongContent && (
                <div className="pl-6 pt-1">
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => !prev)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:text-accent transition-colors cursor-pointer select-none"
                  >
                    <span>{expanded ? 'Show less' : 'Show full details'}</span>
                    {expanded ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-start gap-2.5">
                <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-primary/5 text-primary shrink-0 mt-0.5">
                  <Check className="h-3 w-3" />
                </div>
                <div className="flex-1">
                  <div className={`relative ${!expanded && isLongContent ? 'max-h-16 overflow-hidden' : ''}`}>
                    <p className="text-xs leading-relaxed text-fg break-words font-medium">
                      {(parsed as ParsedPlain).content}
                    </p>
                    {!expanded && isLongContent && (
                      <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-surface to-transparent pointer-events-none" />
                    )}
                  </div>
                  {isLongContent && (
                    <button
                      type="button"
                      onClick={() => setExpanded((prev) => !prev)}
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:text-accent transition-colors cursor-pointer"
                    >
                      <span>{expanded ? 'Show less' : 'Show full details'}</span>
                      {expanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Delete Button */}
        <button
          onClick={() => onDelete(memory)}
          type="button"
          className="opacity-0 group-hover:opacity-100 flex h-7 w-7 items-center justify-center rounded-lg text-fg-muted hover:bg-danger/10 hover:text-danger transition-all duration-200 focus:opacity-100 shrink-0 self-start cursor-pointer"
          aria-label="Delete preference"
          title="Delete memory"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export default function MemoryPage() {
  const { user, updateUser } = useAuth()
  const [memories, setMemories] = useState<UserMemory[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [newMemoryText, setNewMemoryText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [pendingDeleteMemory, setPendingDeleteMemory] = useState<UserMemory | null>(null)
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Fetch memories on mount
  const fetchMemories = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getMemoriesRequest()
      setMemories(data)
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to retrieve memories'
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMemories()
  }, [fetchMemories])

  // Toggle memory active status
  const handleToggleMemory = async () => {
    if (toggling) return
    const nextState = !user?.memory_enabled
    setToggling(true)
    try {
      await toggleMemoryRequest(nextState)
      updateUser({ memory_enabled: nextState })
      toast.success(nextState ? 'AI Memory enabled' : 'AI Memory paused')
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to toggle memory setting'
      toast.error(errorMsg)
    } finally {
      setToggling(false)
    }
  }

  // Create manual memory
  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = newMemoryText.trim()
    if (!content) return

    setSubmitting(true)
    try {
      const created = await createMemoryRequest(content)
      setMemories((prev) => [created, ...prev])
      setNewMemoryText('')
      toast.success('Preference added to memory')
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to add memory'
      toast.error(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  // Delete specific memory
  const handleConfirmDeleteMemory = async () => {
    if (!pendingDeleteMemory) return
    setDeleting(true)
    try {
      await deleteMemoryRequest(pendingDeleteMemory.memory_id)
      setMemories((prev) => prev.filter((m) => m.memory_id !== pendingDeleteMemory.memory_id))
      toast.success('Memory deleted')
      setPendingDeleteMemory(null)
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete memory'
      toast.error(errorMsg)
    } finally {
      setDeleting(false)
    }
  }

  // Clear all memories
  const handleConfirmClearAll = async () => {
    setDeleting(true)
    try {
      await clearMemoriesRequest()
      setMemories([])
      setShowClearConfirmModal(false)
      toast.success('All memories cleared')
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to clear memories'
      toast.error(errorMsg)
    } finally {
      setDeleting(false)
    }
  }

  // Filter memories based on search query
  const filteredMemories = memories.filter((m) =>
    m.content.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const memoryEnabled = user?.memory_enabled ?? true

  return (
    <ChatLayout>
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
          {/* Header Dashboard Banner */}
          <section className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-card">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(15,119,114,0.06),transparent_40%)]" />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 max-w-lg">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-accent">
                  <Brain className="h-3.5 w-3.5" />
                  Memory Manager
                </div>
                <h1 className="text-xl font-bold tracking-tight text-primary">
                  Customize your experience
                </h1>
                <p className="text-xs leading-relaxed text-fg-secondary">
                  Teach MediMei your role, preferred tone, or formatting style. Stored preferences are automatically applied to your future chat answers.
                </p>
              </div>

              {/* Feature Toggle Switch */}
              <div className="flex items-center gap-3 shrink-0 bg-surface-highlight/40 rounded-xl p-2.5 border border-border/60">
                <div className="text-right">
                  <span className="block text-xs font-bold text-fg">AI Memory</span>
                  <span className="text-[10px] text-fg-muted block">
                    {memoryEnabled ? 'Enabled' : 'Paused'}
                  </span>
                </div>
                <button
                  onClick={handleToggleMemory}
                  disabled={toggling}
                  type="button"
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    memoryEnabled ? 'bg-primary' : 'bg-border'
                  }`}
                  role="switch"
                  aria-checked={memoryEnabled}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      memoryEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* Warning state if disabled */}
          {!memoryEnabled && (
            <div className="flex items-center gap-3 rounded-2xl border border-warning/20 bg-warning/5 px-4 py-3 text-xs text-warning animate-fade-in">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                <strong>AI Memory is paused.</strong> MediMei will not access existing memories or save new information from chats until re-enabled.
              </span>
            </div>
          )}

          {/* Grid Layout: Manual Add & Memory List */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column: Manual Form */}
            <div className="md:col-span-1 space-y-4">
              <div className="rounded-2xl border border-border bg-surface p-4 shadow-subtle">
                <h2 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">
                  Add Preference
                </h2>
                <form onSubmit={handleAddMemory} className="space-y-3">
                  <textarea
                    value={newMemoryText}
                    onChange={(e) => setNewMemoryText(e.target.value)}
                    placeholder="e.g. I prefer concise bullet points, I am a pediatric resident..."
                    className="w-full h-28 rounded-xl border border-border bg-background p-3 text-xs text-fg placeholder-fg-muted focus:border-primary focus:outline-none resize-none"
                    disabled={submitting}
                  />
                  <button
                    type="submit"
                    disabled={submitting || !newMemoryText.trim()}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-primary text-white py-2 text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        Save Preference
                      </>
                    )}
                  </button>
                </form>

                {/* Suggestions Box */}
                <div className="mt-4 border-t border-border/60 pt-3">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-fg-muted block mb-2">
                    Try adding:
                  </span>
                  <div className="space-y-1.5">
                    {[
                      'I work in cardiology',
                      'Focus on Rinvoq warnings',
                      'Explain pediatric dosages only',
                    ].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setNewMemoryText(s)}
                        className="w-full text-left text-[11px] text-primary hover:text-accent font-medium truncate block py-0.5"
                      >
                        + {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Search & Memories List */}
            <div className="md:col-span-2 space-y-4">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
                {/* Search Bar */}
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-fg-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search memories..."
                    className="w-full rounded-xl border border-border bg-surface pl-9 pr-3 py-2 text-xs text-fg placeholder-fg-muted focus:border-primary focus:outline-none"
                  />
                </div>

                {/* Clear All Dialog Trigger */}
                {memories.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowClearConfirmModal(true)}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 py-2 text-xs font-bold text-danger hover:bg-danger/5 transition-colors cursor-pointer"
                  >
                    <Trash className="h-3.5 w-3.5" />
                    Clear All Memories
                  </button>
                )}
              </div>

              {/* Memories Cards */}
              <div className="space-y-3">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-16 text-fg-muted gap-2">
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                    <span className="text-xs">Loading stored preferences...</span>
                  </div>
                ) : filteredMemories.length === 0 ? (
                  <div className="rounded-2xl border border-border/60 bg-surface/50 p-12 text-center">
                    <Brain className="h-10 w-10 text-fg-muted/40 mx-auto mb-3" />
                    <h3 className="text-sm font-bold text-fg mb-1">
                      No memories stored
                    </h3>
                    <p className="text-xs text-fg-muted max-w-sm mx-auto">
                      {searchQuery
                        ? 'No match found for your search term.'
                        : 'Memories extracted from your conversations or added manually will appear here.'}
                    </p>
                  </div>
                ) : (
                  filteredMemories.map((m) => (
                    <MemoryItemCard
                      key={m.memory_id}
                      memory={m}
                      onDelete={(mem) => setPendingDeleteMemory(mem)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Grounding and Safety Context Explanation banner */}
          <section className="rounded-xl border border-border bg-surface-highlight/10 p-3.5 flex gap-2.5 text-xs text-fg-muted">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-fg mb-0.5">Clinical Safety Guardrail</p>
              <p>
                Preferences guide format and style only. They will never override verified clinical facts, dosages, or warnings from the original medical documents.
              </p>
            </div>
          </section>
        </div>
      </div>

      {/* Delete Single Memory Modal */}
      {(() => {
        const parsedPending = pendingDeleteMemory
          ? parseMemoryContent(pendingDeleteMemory.content)
          : null

        return (
          <DeleteConfirmModal
            open={!!pendingDeleteMemory}
            title="Delete memory preference?"
            subtitle="This action cannot be undone."
            itemTitle={
              parsedPending
                ? parsedPending.isQA
                  ? `Q: ${parsedPending.question}`
                  : (parsedPending as ParsedPlain).content
                : undefined
            }
            itemSubtitle={
              parsedPending && parsedPending.isQA ? (
                <span className="line-clamp-2">{parsedPending.answer}</span>
              ) : undefined
            }
            description="Are you sure you want to delete this preference? It will no longer guide or personalize MediMei's responses."
            confirmText="Delete Memory"
            cancelText="Cancel"
            loading={deleting}
            onConfirm={handleConfirmDeleteMemory}
            onCancel={() => {
              if (!deleting) setPendingDeleteMemory(null)
            }}
          />
        )
      })()}

      {/* Clear All Memories Modal */}
      <DeleteConfirmModal
        open={showClearConfirmModal}
        title="Clear all memories?"
        subtitle="This action cannot be undone."
        itemTitle={`All ${memories.length} saved memories and preferences`}
        description="Are you sure you want to wipe all stored user preferences, conversational memories, and custom rules? MediMei will reset to default answering style."
        confirmText="Clear All Memories"
        cancelText="Cancel"
        loading={deleting}
        onConfirm={handleConfirmClearAll}
        onCancel={() => {
          if (!deleting) setShowClearConfirmModal(false)
        }}
      />
    </ChatLayout>
  )
}
