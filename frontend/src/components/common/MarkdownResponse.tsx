import React, { useMemo, useState, useRef, useLayoutEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FileText, ChevronRight, CheckCircle2 } from 'lucide-react'
import type { Citation } from '../../types/chat'
import type { ComparisonCitation } from '../../types/comparison'

type AnyCitation = Citation | ComparisonCitation

interface MarkdownResponseProps {
  content: string
  citations?: AnyCitation[]
  onCitationClick?: (citation: AnyCitation) => void
  compact?: boolean
  className?: string
}

/**
 * Pre-processes raw LLM text to ensure clean markdown rendering:
 * 1. Strips <think>...</think> reasoning blocks or stray <think> tags.
 * 2. Strips placeholder patterns.
 * 3. Formats squashed lists (e.g. `* Item 1 * Item 2` or `* Header: * Sub-item:`)
 *    into proper newline-delimited markdown lists.
 */
function preprocessMarkdown(raw: string): string {
  if (!raw) return ''

  let text = raw

  // 1. Remove think blocks
  if (text.includes('</think>')) {
    text = text.split('</think>').pop() || ''
  } else if (text.includes('<think>')) {
    text = text.split('<think>')[0] || ''
  }

  // 2. Remove prompt placeholders
  text = text.replace(/<1-2\s+sentence[^>]*>/gi, '')
  text = text.replace(/\[summary of drug \d+[^\]]*\]/gi, '')
  text = text.replace(/<[^>]+summary[^>]*>/gi, '')

  // 3. Fix squashed lists where asterisks follow text or other asterisks without newlines
  // e.g., "...patient's characteristics. * Crohn's Disease: * Induction: ..."
  // Replace ` * ` preceded by non-newline with `\n* `
  text = text.replace(/([^\n])\s+(\*\s+[A-Za-z0-9])/g, '$1\n$2')
  // Fix nested asterisks like `* Crohn's Disease: * Induction:` -> `* Crohn's Disease:\n  * Induction:`
  text = text.replace(/:\s+\*\s+/g, ':\n  * ')

  // 4. Clean orphan bracket citations like `[S3` at the end of truncated strings
  text = text.replace(/\[S\d*$/g, '')

  return text.trim()
}

/**
 * Inline Citation Pill Component with Hover Tooltip
 */
function InlineCitationPill({
  citationId,
  citations,
  onCitationClick,
}: {
  citationId: string
  citations?: AnyCitation[]
  onCitationClick?: (citation: AnyCitation) => void
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)

  // Find matching citation by ID (e.g. S1, S2) or fallback to index matching
  const matchedCitation = useMemo(() => {
    if (!citations || citations.length === 0) return null

    // Exact ID match
    const exact = citations.find(
      (c) =>
        c.citationId === citationId ||
        c.citationId === `[${citationId}]` ||
        c.citationId.toLowerCase() === citationId.toLowerCase(),
    )
    if (exact) return exact

    // Match numeric index e.g. S1 -> citations[0]
    const numMatch = citationId.match(/\d+/)
    if (numMatch) {
      const idx = parseInt(numMatch[0], 10) - 1
      if (idx >= 0 && idx < citations.length) {
        return citations[idx]
      }
    }

    return null
  }, [citations, citationId])

  const label = citationId.replace(/^S/i, '').trim() || citationId

  const handleMouseEnter = () => {
    setTooltipOpen(true)
  }

  const handleMouseLeave = () => {
    setTooltipOpen(false)
  }

  useLayoutEffect(() => {
    if (tooltipOpen && buttonRef.current && tooltipRef.current) {
      const btnRect = buttonRef.current.getBoundingClientRect()
      const ttRect = tooltipRef.current.getBoundingClientRect()
      const gap = 8
      let top = btnRect.top - ttRect.height - gap
      if (top < gap) {
        top = btnRect.bottom + gap
      }
      const halfWidth = ttRect.width / 2
      let left = btnRect.left + btnRect.width / 2
      left = Math.max(halfWidth + gap, Math.min(window.innerWidth - halfWidth - gap, left))
      setTooltipPos({ top, left })
    }
  }, [tooltipOpen])

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (matchedCitation && onCitationClick) {
      onCitationClick(matchedCitation)
    }
  }

  const docName = matchedCitation?.documentName || 'Source Document'
  const pageNo = matchedCitation?.page
  const section = matchedCitation?.section
  const snippet = matchedCitation?.text

  return (
    <span className="relative inline-block align-baseline mx-0.5 my-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-label={`Citation ${citationId}${pageNo ? `, Page ${pageNo}` : ''}`}
        className="inline-flex items-center justify-center gap-0.5 px-1.5 py-0.2 rounded-full text-[11px] font-bold font-mono text-accent bg-accent/10 border border-accent/25 hover:bg-accent hover:text-white hover:border-accent shadow-2xs transition-all duration-150 cursor-pointer active:scale-95 select-none"
      >
        <span className="text-[9px] opacity-75 font-sans font-semibold">S</span>
        <span>{label}</span>
      </button>

      {/* Floating Tooltip */}
      {tooltipOpen && (
        <span
          ref={tooltipRef}
          style={{
            top: `${tooltipPos.top}px`,
            left: `${tooltipPos.left}px`,
            transform: 'translateX(-50%)',
          }}
          className="fixed z-50 pointer-events-none w-72 max-w-[90vw] p-3 rounded-xl bg-surface border border-border shadow-xl text-left animate-fade-in"
        >
          <span className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5 mb-1.5">
            <span className="flex items-center gap-1.5 text-xs font-bold text-primary truncate">
              <FileText className="h-3.5 w-3.5 text-accent shrink-0" />
              <span className="truncate">{docName}</span>
            </span>
            {pageNo !== undefined && (
              <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                Page {pageNo}
              </span>
            )}
          </span>

          {section && (
            <span className="block text-[11px] font-semibold text-fg-secondary mb-1">
              Section: {section}
            </span>
          )}

          {snippet ? (
            <span className="block text-[11px] text-fg-muted line-clamp-3 leading-relaxed italic bg-surface-highlight/40 p-1.5 rounded-lg">
              "{snippet}"
            </span>
          ) : (
            <span className="block text-[10px] text-accent font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Click to view grounded source chunk
            </span>
          )}

          <span className="mt-1.5 flex items-center justify-end gap-1 text-[10px] font-semibold text-accent">
            <span>View evidence</span>
            <ChevronRight className="h-3 w-3" />
          </span>
        </span>
      )}
    </span>
  )
}

/**
 * Replaces inline citation markers like `[S1]`, `[S2]`, `[S1], [S2]` with Citation Pill elements
 */
function renderContentWithCitations(
  children: React.ReactNode,
  citations?: AnyCitation[],
  onCitationClick?: (citation: AnyCitation) => void,
): React.ReactNode {
  if (typeof children === 'string') {
    // Match [S1], [S2], [s1], [1], [2], etc.
    const citationRegex = /\[(S\d+|\d+)\]/gi
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = citationRegex.exec(children)) !== null) {
      const matchIndex = match.index
      if (matchIndex > lastIndex) {
        parts.push(children.substring(lastIndex, matchIndex))
      }

      const citId = match[1].toUpperCase().startsWith('S')
        ? match[1].toUpperCase()
        : `S${match[1]}`

      parts.push(
        <InlineCitationPill
          key={`${citId}-${matchIndex}`}
          citationId={citId}
          citations={citations}
          onCitationClick={onCitationClick}
        />,
      )

      lastIndex = matchIndex + match[0].length
    }

    if (lastIndex < children.length) {
      parts.push(children.substring(lastIndex))
    }

    return parts.length > 0 ? parts : children
  }

  if (Array.isArray(children)) {
    return React.Children.map(children, (child) =>
      renderContentWithCitations(child, citations, onCitationClick),
    )
  }

  return children
}

export function MarkdownResponse({
  content,
  citations = [],
  onCitationClick,
  compact = false,
  className = '',
}: MarkdownResponseProps) {
  const processed = useMemo(() => preprocessMarkdown(content), [content])

  if (!processed) {
    return null
  }

  return (
    <div
      className={`prose-clinical text-fg ${compact ? 'text-[13px] leading-relaxed' : 'text-sm leading-relaxed'
        } ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="mb-3 last:mb-0 leading-relaxed text-fg">
              {renderContentWithCitations(children, citations, onCitationClick)}
            </p>
          ),
          h1: ({ children }) => (
            <h1 className="text-lg font-extrabold tracking-tight text-primary mt-4 mb-2 first:mt-0 border-b border-border/50 pb-1">
              {renderContentWithCitations(children, citations, onCitationClick)}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold tracking-tight text-primary mt-3.5 mb-2 first:mt-0">
              {renderContentWithCitations(children, citations, onCitationClick)}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-bold text-primary mt-3 mb-1.5 first:mt-0">
              {renderContentWithCitations(children, citations, onCitationClick)}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-xs font-bold uppercase tracking-wider text-accent mt-2.5 mb-1 first:mt-0">
              {renderContentWithCitations(children, citations, onCitationClick)}
            </h4>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-primary font-semibold">
              {renderContentWithCitations(children, citations, onCitationClick)}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-fg-secondary">
              {renderContentWithCitations(children, citations, onCitationClick)}
            </em>
          ),
          ul: ({ children }) => (
            <ul className="my-2 list-none space-y-1.5 pl-1">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 list-decimal pl-5 space-y-1.5 text-fg">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="relative pl-5 leading-relaxed text-fg before:content-['•'] before:absolute before:left-1 before:top-0 before:text-accent before:font-bold before:text-base">
              {renderContentWithCitations(children, citations, onCitationClick)}
            </li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2.5 rounded-xl border-l-4 border-accent bg-accent/5 px-3.5 py-2 text-xs italic text-fg-secondary">
              {renderContentWithCitations(children, citations, onCitationClick)}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-border bg-surface shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-surface-highlight/70 text-primary font-bold border-b border-border">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3.5 py-2.5 font-bold uppercase tracking-wider text-[11px] text-primary">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3.5 py-2 border-b border-border/50 text-fg-secondary">
              {renderContentWithCitations(children, citations, onCitationClick)}
            </td>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.includes('language-')
            if (isBlock) {
              return (
                <div className="my-2 rounded-xl bg-surface-highlight/80 border border-border p-3 font-mono text-xs overflow-x-auto text-fg">
                  <code>{children}</code>
                </div>
              )
            }
            return (
              <code className="rounded-md bg-surface-highlight px-1.5 py-0.5 font-mono text-[0.85em] font-medium text-accent border border-border/40">
                {children}
              </code>
            )
          },
          hr: () => <hr className="my-3 border-border/60" />,
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  )
}

export default MarkdownResponse
