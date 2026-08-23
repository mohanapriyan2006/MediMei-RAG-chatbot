import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, FileText, MoreHorizontal, Pencil, Trash2, Eye, X, MessageSquare, Calendar, FileDigit, HardDrive } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { formatDate, formatFileSize } from '../../utils/formatters'
import type { Document } from '../../types/document'
import { DocumentStatus } from './DocumentStatus'

interface DocumentCardProps {
  document: Document
  onDelete: (doc: Document) => void
  onView?: (doc: Document) => void
  isSelected?: boolean
}

export function DocumentCard({ document, onDelete, onView, isSelected = false }: DocumentCardProps) {
  const { renameDocument } = useDocuments()
  const [renaming, setRenaming] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [name, setName] = useState(document.name)
  const chatHref = `/chat?new=1&doc=${encodeURIComponent(document.id)}&q=${encodeURIComponent(`Tell me about ${document.name} indications, dosage, warnings, and contraindications`)}`

  const commitRename = () => {
    renameDocument(document.id, name)
    setRenaming(false)
  }

  const cancelRename = () => {
    setName(document.name)
    setRenaming(false)
  }

  return (
    <div
      id={`doc-${document.id}`}
      className={`relative flex flex-col rounded-2xl border bg-surface p-4 transition-all hover:shadow-card ${
        isSelected ? 'border-primary/30 shadow-card ring-1 ring-primary/10' : 'border-border hover:border-primary/30'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-highlight text-primary">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </div>

        {/* Name + Filename */}
        <div className="min-w-0 flex-1">
          {renaming ? (
            <div className="flex items-center gap-1">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') cancelRename()
                }}
                autoFocus
                className="clinical-input w-full px-2 py-1.5 text-sm font-medium"
              />
              <button
                type="button"
                onClick={commitRename}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-success hover:bg-surface-highlight"
                aria-label="Save name"
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={cancelRename}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-fg-muted hover:bg-surface-highlight"
                aria-label="Cancel rename"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <h3
              className="truncate text-sm font-semibold text-fg leading-snug"
              title={document.name}
            >
              {document.name}
            </h3>
          )}
          <p className="mt-0.5 truncate text-xs text-fg-muted" title={document.filename}>
            {document.filename}
          </p>
        </div>

        {/* Three-dot Menu */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-surface-highlight hover:text-fg"
            aria-label="Document actions"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute right-0 top-9 z-20 w-36 rounded-2xl border border-border bg-surface py-1 shadow-hover">
                <MenuItem
                  icon={Eye}
                  label="View details"
                  onClick={() => {
                    setMenuOpen(false)
                    onView?.(document)
                  }}
                />
                <MenuItem
                  icon={Pencil}
                  label="Rename"
                  onClick={() => {
                    setMenuOpen(false)
                    setRenaming(true)
                  }}
                />
                <div className="my-0.5 border-t border-line" />
                <MenuItem
                  icon={Trash2}
                  label="Delete"
                  danger
                  onClick={() => {
                    setMenuOpen(false)
                    onDelete(document)
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Active
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          FDA Grounded
        </span>
        <DocumentStatus status={document.status} stage={document.stage} progress={document.progress} progressDetail={document.progressDetail} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs text-fg-muted sm:grid-cols-4">
        <MetaItem icon={Calendar} label="Uploaded" value={formatDate(document.uploadedAt)} />
        <MetaItem icon={FileDigit} label="Pages" value={document.pageCount ? `${document.pageCount}` : '—'} />
        <MetaItem icon={HardDrive} label="File size" value={formatFileSize(document.fileSize)} />
        <MetaItem icon={FileText} label="Status" value={document.status === 'ready' ? 'Ready' : document.status === 'failed' ? 'Failed' : (document.progressDetail || 'Processing')} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onView?.(document)}
          className="inline-flex items-center justify-center rounded-pill border border-border bg-surface px-4 py-2 text-xs font-semibold text-fg transition-colors hover:border-primary/30 hover:text-primary"
        >
          View Details
        </button>
        <Link
          to={chatHref}
          className="inline-flex items-center justify-center gap-1.5 rounded-pill bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Open in AI Chat
        </Link>
      </div>
    </div>
  )
}

function MetaItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-border bg-surface/80 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-fg-muted">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
      <div className="mt-1 truncate text-xs font-semibold text-fg">{value}</div>
    </div>
  )
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-highlight ${
        danger ? 'text-danger' : 'text-fg'
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
}
