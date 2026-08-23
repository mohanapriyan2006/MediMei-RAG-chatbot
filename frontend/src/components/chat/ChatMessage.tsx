import { useCallback, useState, useRef } from 'react'
import { Check, Copy, FileText, Sparkles, AlertCircle, Volume2, Square, Brain, ChevronDown, ChevronUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useChat } from '../../hooks/useChat'
import type { ChatMessage as ChatMessageType, Citation } from '../../types/chat'
import { CitationBadge } from './CitationBadge'
import { FollowUpList } from './FollowUpList'
import { StreamingText } from './StreamingText'
import { MarkdownResponse } from '../common/MarkdownResponse'

interface ChatMessageProps {
  message: ChatMessageType
  isLast: boolean
  onOpenEvidence?: () => void
}

/* ── Collapsible Profile Info ─────────────────────────────────────── */
function ProfileInfoSection({ memories }: { memories: string[] }) {
  const [expanded, setExpanded] = useState(false)
  if (!memories || memories.length === 0) return null

  return (
    <div className="rounded-2xl border border-primary/15 bg-primary/5 p-2.5 transition-all duration-200">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 text-left cursor-pointer select-none"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Brain className="h-3 w-3" />
          </div>
          <span className="text-xs font-semibold text-primary">
            Used Profile Info
          </span>
          <span className="rounded-full bg-primary/15 px-2 py-0.2 text-[10px] font-bold text-primary">
            {memories.length} item{memories.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-medium text-primary/80 hover:text-primary">
          <span>{expanded ? 'Minimize info' : 'Expand profile info'}</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>

      {expanded && (
        <div className="mt-2.5 space-y-2 border-t border-primary/10 pt-2.5">
          {memories.map((mem, idx) => {
            if (mem.startsWith('Q: ') && mem.includes(' | A: ')) {
              const [qPart, aPart] = mem.split(' | A: ')
              const question = qPart.replace(/^Q:\s*/, '')
              return (
                <div key={idx} className="rounded-xl border border-border/60 bg-surface/80 p-2.5 text-xs shadow-xs">
                  <div className="font-semibold text-primary flex items-start gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider rounded bg-primary/10 px-1.5 py-0.5 text-primary">Question</span>
                    <span className="mt-0.5">{question}</span>
                  </div>
                  <div className="mt-2 text-fg-secondary leading-relaxed pl-3 text-[11px] border-l-2 border-primary/30">
                    {aPart}
                  </div>
                </div>
              )
            }
            return (
              <div key={idx} className="flex items-center gap-2 rounded-xl border border-border/50 bg-surface/60 px-3 py-1.5 text-xs text-fg-secondary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span>{mem}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Collapsible Saved Memory ─────────────────────────────────────── */
function MemorySavedSection({ memories }: { memories: string[] }) {
  const [expanded, setExpanded] = useState(false)
  if (!memories || memories.length === 0) return null

  return (
    <div className="rounded-2xl border border-accent/20 bg-accent/5 p-2.5 transition-all duration-200">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 text-left cursor-pointer select-none"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Sparkles className="h-3 w-3" />
          </div>
          <span className="text-xs font-semibold text-accent">
            Memory Saved
          </span>
          <span className="rounded-full bg-accent/15 px-2 py-0.2 text-[10px] font-bold text-accent">
            {memories.length} item{memories.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-medium text-accent/80 hover:text-accent">
          <span>{expanded ? 'Minimize' : 'Expand'}</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>

      {expanded && (
        <div className="mt-2.5 space-y-1.5 border-t border-accent/10 pt-2.5">
          {memories.map((mem, idx) => (
            <div key={idx} className="flex items-center gap-2 rounded-xl border border-border/50 bg-surface/60 px-3 py-1.5 text-xs text-fg-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
              <span>{mem}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── User Bubble ─────────────────────────────────────────────── */
function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end animate-fade-in-up" style={{ animationDelay: '0ms' }}>
      <div className="flex items-end gap-2.5 max-w-[85%] md:max-w-2xl">
        <div className="rounded-3xl rounded-br-sm bg-primary px-5 py-3.5 text-sm text-white shadow-card">
          <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
        </div>
      </div>
    </div>
  )
}

/* ── Action Icon Button ──────────────────────────────────────── */
function ActionButton({
  onClick,
  icon: Icon,
  label,
}: {
  onClick: () => void
  icon: LucideIcon
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-full text-fg-muted transition-all duration-150 hover:bg-surface-highlight hover:text-fg"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  )
}

/* ── Collapsible Thinking / Reasoning Process ─────────────────────── */
function ThinkingSection({ thinking }: { thinking?: string }) {
  const [expanded, setExpanded] = useState(false)
  if (!thinking || !thinking.trim()) return null

  return (
    <div className="mb-3.5 rounded-2xl border border-border/70 bg-surface-subtle/50 p-2.5 transition-all duration-200 hover:border-border">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 text-left cursor-pointer select-none"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-5.5 w-5.5 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Brain className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-semibold text-fg">
            Thought Process
          </span>
          <span className="rounded-full bg-surface-highlight px-2 py-0.5 text-[10px] font-mono text-fg-muted">
            Internal Reasoning
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-medium text-fg-muted hover:text-fg">
          <span>{expanded ? 'Hide thinking' : 'Show thinking'}</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>

      {expanded && (
        <div className="mt-2.5 max-h-64 overflow-y-auto rounded-xl border border-border/50 bg-surface-subtle p-3 text-xs font-mono leading-relaxed text-fg-muted whitespace-pre-wrap shadow-inner">
          {thinking.trim()}
        </div>
      )}
    </div>
  )
}

function AssistantMessage({
  message,
  isLast,
  onOpenEvidence,
}: {
  message: ChatMessageType
  isLast: boolean
  onOpenEvidence?: () => void
}) {
  const [done, setDone] = useState(!isLast)
  const [copied, setCopied] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const { sendMessage, setSelectedMessageId, setSelectedCitation } = useChat()
  const onComplete = useCallback(() => setDone(true), [])
  const isStreaming = isLast && !done

  const citations = message.citations ?? []
  const followUps = message.followUps ?? []

  const handleCitationClick = useCallback(
    (citation: unknown) => {
      setSelectedCitation(citation as Citation)
      onOpenEvidence?.()
    },
    [setSelectedCitation, onOpenEvidence],
  )

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const stripMarkdown = (text: string) =>
    text
      .replace(/<[^>]*>/g, '')
      .replace(/\[(S\d+|\d+)\]/gi, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/__/g, '')
      .replace(/`/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')

  const handleSpeak = () => {
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const utterance = new SpeechSynthesisUtterance(stripMarkdown(message.content))
    utterance.rate = 1
    utterance.pitch = 1
    utterance.onend = () => {
      setSpeaking(false)
      utteranceRef.current = null
    }
    utterance.onerror = () => {
      setSpeaking(false)
      utteranceRef.current = null
    }
    utteranceRef.current = utterance
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    setSpeaking(true)
  }

  const isAbstaining =
    message.status === 'insufficient_evidence' ||
    message.content.toLowerCase().includes("couldn't find sufficient information")

  return (
    <div
      onClick={() => setSelectedMessageId(message.id)}
      className="flex items-start gap-3 animate-fade-in-up"
      style={{ animationDelay: '30ms' }}
    >
      <div className="min-w-0 flex-1">
        <div className="max-w-3xl transition-all duration-200">
          {/* Status Header */}
          <div className="mb-3.5 flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-primary text-white shadow-subtle transition-all duration-200 group-hover:shadow-card">
                <img src="/logo.png" alt="MediMei" className="h-8 w-8 object-contain" />
              </div>
              <span className="text-xs font-bold text-primary">MediMei Assistant</span>
              {isAbstaining ? (
                <span className="inline-flex items-center gap-1 rounded-pill bg-warning/10 px-2 py-0.5 text-[10px] font-bold text-warning">
                  <AlertCircle className="h-2.5 w-2.5" />
                  <span>Clinical Abstention</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-pill bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">
                  <Sparkles className="h-2.5 w-2.5" />
                  <span>Grounded Answer</span>
                </span>
              )}
            </div>
            {citations.length > 0 && (
              <span className="text-[10px] text-fg-muted font-mono tabular-nums">
                {citations.length} source{citations.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {/* Thinking / Reasoning Dropdown */}
          <ThinkingSection thinking={message.thinking} />

          {/* Answer Text */}
          {!isStreaming ? (
            <MarkdownResponse
              content={message.content}
              citations={citations}
              onCitationClick={handleCitationClick}
            />
          ) : (
            <StreamingText
              content={message.content}
              citations={citations}
              onCitationClick={handleCitationClick}
              onComplete={onComplete}
            />
          )}
        </div>

        {/* Memory Updates/Uses notifications (Collapsible) */}
        {!isStreaming && ((message.memoriesUsed && message.memoriesUsed.length > 0) || (message.memoriesUpdated && message.memoriesUpdated.length > 0)) && (
          <div className="mt-3.5 space-y-2 border-t border-border/40 pt-3">
            {message.memoriesUsed && message.memoriesUsed.length > 0 && (
              <ProfileInfoSection memories={message.memoriesUsed} />
            )}
            {message.memoriesUpdated && message.memoriesUpdated.length > 0 && (
              <MemorySavedSection memories={message.memoriesUpdated} />
            )}
          </div>
        )}

        {/* Citation Badges */}
        {!isStreaming && citations.length > 0 && (
          <div className="mt-4 pt-3.5 border-t border-border">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-fg-muted mb-2.5">
              Supporting Citations
            </p>
            <div className="flex flex-wrap gap-2" role="list" aria-label="Citations">
              {citations.map((c) => (
                <CitationBadge
                  key={c.citationId}
                  citation={c}
                  onClick={onOpenEvidence}
                />
              ))}
            </div>
          </div>
        )}

        {/* Action Toolbar */}
        {!isStreaming && (
          <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-fg-muted">
              <FileText className="h-3 w-3 text-accent shrink-0" />
              <span>
                {citations.length > 0
                  ? 'Click a citation to inspect the source'
                  : 'No external sources cited'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <ActionButton
                onClick={handleSpeak}
                icon={speaking ? Square : Volume2}
                label={speaking ? 'Stop reading' : 'Read aloud'}
              />
              <ActionButton
                onClick={handleCopy}
                icon={copied ? Check : Copy}
                label={copied ? 'Copied!' : 'Copy answer'}
              />
            </div>
          </div>
        )}

        {/* Follow-up Suggestions */}
        {!isStreaming && followUps.length > 0 && (
          <FollowUpList questions={followUps} onSelect={sendMessage} />
        )}
      </div>
    </div>
  )
}

/* ── Exported Component ──────────────────────────────────────── */
export function ChatMessage({ message, isLast, onOpenEvidence }: ChatMessageProps) {
  if (message.role === 'user') {
    return <UserMessage content={message.content} />
  }
  return <AssistantMessage message={message} isLast={isLast} onOpenEvidence={onOpenEvidence} />
}

export default ChatMessage
