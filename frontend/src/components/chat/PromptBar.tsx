import { useRef, useState, useEffect, useLayoutEffect } from 'react'
import { Send, Mic, Loader2, FolderOpen } from 'lucide-react'
import { useChat } from '../../hooks/useChat'
import { useDocuments } from '../../hooks/useDocuments'
import { useTask } from '../../hooks/useTask'
import { useSearchParams } from 'react-router-dom'
import { useVoiceInput } from '../../hooks/useVoiceInput'
import { DocumentSelectorModal } from './DocumentSelectorModal'
import { SelectedDocChips, AttachmentChips } from './PromptBarChips'

export function PromptBar() {
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState<string[]>([])
  const [expanded, setExpanded] = useState(false)
  const [docModalOpen, setDocModalOpen] = useState(false)
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const valueRef = useRef('')
  const { sendMessage, isLoading, clearChat } = useChat()
  const { documents } = useDocuments()
  const { currentTask } = useTask()

  const isTaskRunning = currentTask.status === 'running'
  const isBlocked = isTaskRunning && currentTask.type !== 'chat'
  const [searchParams] = useSearchParams()

  const { listening, toggleListening } = useVoiceInput({
    valueRef,
    onTranscript: setValue,
    textareaRef,
  })

  const readyDocs = documents.filter((d) => d.status === 'ready')
  const selectedDocs = readyDocs.filter((d) => selectedDocIds.includes(d.id))
  const allSelected = selectedDocIds.length === readyDocs.length && readyDocs.length > 0

  useEffect(() => {
    const q = searchParams.get('q')
    const doc = searchParams.get('doc')
    const isNew = searchParams.get('new') === '1'
    if (q && !value) {
      setValue(q)
    }
    if (isNew) {
      clearChat()
    }
    if (doc) {
      setSelectedDocIds([doc])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useLayoutEffect(() => {
    const input = textareaRef.current
    const measure = measureRef.current
    if (!input) return

    const minHeight = 28
    const maxHeight = 120
    input.style.height = '0px'
    const contentHeight = input.scrollHeight
    input.style.height = `${Math.min(Math.max(contentHeight, minHeight), maxHeight)}px`
    input.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden'

    if (measure) {
      const needsExpand = value.includes('\n') || measure.offsetWidth + 8 > input.clientWidth
      if (needsExpand !== expanded) setExpanded(needsExpand)
    }
  }, [value, expanded])

  const canSubmit = !isLoading && !isTaskRunning && !!value.trim()

  const handleSubmit = () => {
    if (!canSubmit) return
    if (isTaskRunning) return
    sendMessage(value.trim(), selectedDocIds)
    setValue('')
    setAttachments([])
    setSelectedDocIds([])
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  useEffect(() => {
    valueRef.current = value
  }, [value])

  return (
    <div className="w-full">
      {isBlocked && (
        <div
          role="alert"
          className="mb-2 flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-2 text-xs font-semibold text-warning"
        >
          {currentTask.type === 'compare'
            ? 'A comparison is in progress. Wait or switch to Compare.'
            : currentTask.type === 'document'
              ? 'A document is being processed. Wait or switch to Documents.'
              : 'Another task is in progress. Please wait.'}
        </div>
      )}
      <SelectedDocChips
        selectedDocs={selectedDocs}
        allSelected={allSelected}
        onClearAll={() => setSelectedDocIds([])}
        onRemoveDoc={(id) => setSelectedDocIds((prev) => prev.filter((d) => d !== id))}
      />

      <div
        className={`relative isolate flex flex-col gap-1.5 overflow-hidden border border-border bg-surface p-1.5 sm:p-2 shadow-card transition-all duration-150 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 ${attachments.length > 0 || expanded ? 'rounded-2xl' : 'rounded-full'
          }`}
      >
        {/* hidden measure span for auto-expand */}
        <span
          ref={measureRef}
          aria-hidden="true"
          className="pointer-events-none absolute invisible whitespace-pre text-[13px] leading-[18px]"
        >
          {value}
        </span>

        <AttachmentChips attachments={attachments} onRemove={removeAttachment} />

        {/* controls row */}
        <div
          ref={controlsRef}
          className={`grid items-end gap-x-1.5 gap-y-1.5 sm:gap-x-2 sm:gap-y-2 ${expanded
            ? 'grid-cols-[28px_28px_28px]'
            : 'grid-cols-[28px_minmax(0,1fr)_28px_28px]'
            }`}
        >
          {/* document selector button  className={`flex h-7 w-7 shrink-0 items-center justify-center justify-self-start rounded-lg text-fg-muted transition-all duration-150 hover:bg-surface-highlight hover:text-fg active:scale-95 ${
              attachments.length > 0 ? 'text-primary' : ''
            } ${expanded ? 'col-start-1 row-start-2' : 'col-start-1 row-start-1'}`}*/}
          <button
            type="button"
            aria-label="Select saved documents"
            onClick={() => setDocModalOpen(true)}
            className={`flex h-7 w-7 shrink-0 items-center justify-center justify-self-start rounded-lg text-fg-muted transition-all duration-150 hover:bg-surface-highlight hover:text-fg active:scale-95  ${selectedDocIds.length > 0
              ? 'bg-primary/10 text-primary'
              : 'text-fg-muted hover:bg-surface-highlight hover:text-fg'
              } ${expanded ? 'col-start-1 row-start-2' : 'col-start-1 row-start-1'}`}
          >
            <FolderOpen className="h-3.5 w-3.5" strokeWidth={2} />
          </button>

          {/* textarea */}
          <textarea
            ref={textareaRef}
            // rows={1}
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={listening ? 'Listening…' : 'Ask about dosage, warnings, contraindications…'}
            aria-label="Ask about medication"
            disabled={isLoading || isTaskRunning}
            className={`min-h-7 max-h-[40px] w-full resize-none bg-transparent px-1 py-[5px] text-[13px] leading-[18px] text-fg outline-none placeholder:text-fg-muted ${
              expanded ? 'col-span-full col-start-2 row-start-1' : 'col-start-2 row-start-1'
            }`}
          />


          {/* mic / dictation button */}
          <button
            type="button"
            aria-label={listening ? 'Stop dictation' : 'Start dictation'}
            aria-pressed={listening}
            onClick={toggleListening}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-150 active:scale-95 ${listening
              ? 'bg-primary/10 text-primary'
              : 'text-fg-muted hover:bg-surface-highlight hover:text-fg'
              } ${expanded ? 'col-start-2 row-start-2' : 'col-start-3 row-start-1'}`}
          >
            {listening ? (
              <span className="flex h-3.5 items-center gap-[2.5px]">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-[2.5px] rounded-full bg-current"
                    style={{
                      height: '100%',
                      animation: `eq-bounce 900ms ease-in-out ${i * 150}ms infinite`,
                    }}
                  />
                ))}
              </span>
            ) : (
              <Mic className="h-3.5 w-3.5" strokeWidth={2} />
            )}
          </button>

          {/* send button */}
          <button
            type="button"
            aria-label="Send clinical inquiry"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200 enabled:active:scale-95 ${expanded ? 'col-start-3 row-start-2' : 'col-start-4 row-start-1'
              }`}
            style={{
              background: canSubmit ? 'var(--color-primary)' : 'var(--color-border)',
              color: canSubmit ? 'var(--color-surface)' : 'var(--color-foreground-muted)',
            }}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-0.5" strokeWidth={2.4} />
            )}
          </button>
        </div>
      </div>

      <DocumentSelectorModal
        open={docModalOpen}
        onClose={() => setDocModalOpen(false)}
        documents={documents}
        selectedIds={selectedDocIds}
        onConfirm={setSelectedDocIds}
      />
    </div>
  )
}

export default PromptBar
