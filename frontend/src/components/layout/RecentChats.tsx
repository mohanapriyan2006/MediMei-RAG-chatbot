import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Check, MoreVertical, Pencil, Trash2, X, AlertTriangle } from 'lucide-react'
import { useConversations } from '../../hooks/useConversations'
import { Tooltip } from '../common/Tooltip'
import { useNavigate } from 'react-router-dom'
interface RecentChatsProps {
  collapsed: boolean
  onClose?: () => void
}

export function RecentChats({ collapsed }: RecentChatsProps) {
  const {
    conversations,
    activeConversationId,
    selectConversation,
    renameConversation,
    deleteConversation,
  } = useConversations()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const navigate = useNavigate();

  const sorted = [...conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )

  const commitEdit = () => {
    if (editingId) renameConversation(editingId, editValue)
    setEditingId(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValue('')
  }

  useEffect(() => {
    if (!menuOpenId) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpenId])

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteConversation(deleteTarget.id)
      setDeleteTarget(null)
    }
  }

  /* ── Collapsed view ─────────────────────────────────────── */
  if (collapsed) {
    return (
      <nav className="flex flex-col items-center gap-0.5 px-2 py-1" aria-label="Recent chats">
        {sorted.slice(0, 8).map((c) => (
          <Tooltip key={c.id} content={c.title} side="right">
            <button
              type="button"
              onClick={() =>{
                navigate(`/chat/${c.id}`);
                selectConversation(c.id);
              }}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
                activeConversationId === c.id
                  ? 'bg-primary-soft text-primary'
                  : 'text-fg-muted hover:bg-surface-highlight hover:text-fg'
              }`}
              aria-label={c.title}
            >
              {c.title.charAt(0).toUpperCase()}
            </button>
          </Tooltip>
        ))}
      </nav>
    )
  }

  /* ── Expanded view ─────────────────────────────────────── */
  return (
    <nav className="flex flex-col" aria-label="Recent chats">
      {/* Section Label */}
      <div className="px-4 pb-1 pt-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-fg-subtle">
          Chats
        </span>
      </div>

      {sorted.map((c) => {
        const isActive = activeConversationId === c.id
        const isEditing = editingId === c.id
        return (
          <div
            key={c.id}
            className={`group relative flex items-center rounded-2xl transition-colors ${
              isActive ? 'bg-surface-highlight' : 'hover:bg-surface-highlight'
            }`}
          >
            {isEditing ? (
              <div className="flex w-full items-center gap-1 px-2 py-1.5">
                <input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit()
                    if (e.key === 'Escape') cancelEdit()
                  }}
                  autoFocus
                  className="clinical-input w-full px-2 py-1.5 text-sm text-fg"
                />
                <button
                  type="button"
                  onClick={commitEdit}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-success hover:bg-surface"
                  aria-label="Save name"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-fg-muted hover:bg-surface"
                  aria-label="Cancel rename"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/chat/${c.id}`)
                    selectConversation(c.id)
                  }}
                  className="flex min-w-0 flex-1 items-center px-2 py-2 text-left text-sm text-fg"
                >
                  <span
                    className={`truncate text-sm ${
                      isActive ? 'font-medium text-fg' : 'text-fg-muted'
                    }`}
                  >
                    {c.title}
                  </span>
                </button>

                {/* Three-dot menu */}
                <div className="relative shrink-0 pr-1" ref={menuOpenId === c.id ? menuRef : undefined}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpenId(menuOpenId === c.id ? null : c.id)
                    }}
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-surface hover:text-fg ${
                      menuOpenId === c.id ? 'bg-surface text-fg' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    aria-label="More options"
                    aria-expanded={menuOpenId === c.id}
                  >
                    <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>

                  {menuOpenId === c.id && (
                    <div
                      className="absolute right-0 top-full z-20 mt-1 w-32 overflow-hidden rounded-xl border border-border bg-surface shadow-card animate-fade-in"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(c.id)
                          setEditValue(c.title)
                          setMenuOpenId(null)
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-fg transition-colors hover:bg-surface-highlight"
                      >
                        <Pencil className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
                        <span>Rename</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteTarget({ id: c.id, title: c.title })
                          setMenuOpenId(null)
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-danger transition-colors hover:bg-surface-highlight"
                      >
                        <Trash2 className="h-3.5 w-3.5 shrink-0" />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )
      })}

      {conversations.length === 0 && (
        <p className="px-4 py-3 text-xs text-fg-subtle">
          No conversations yet. Start by asking a question.
        </p>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4"
          onClick={() => setDeleteTarget(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-hover animate-fade-in"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-fg">Delete conversation?</h3>
                <p className="mt-0.5 text-xs text-fg-muted">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="mb-4 rounded-lg bg-surface-highlight px-3 py-2">
              <p className="truncate text-xs text-fg-muted">
                <span className="font-medium text-fg">{deleteTarget.title}</span>
              </p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-pill border border-border bg-surface px-4 py-2 text-xs font-semibold text-fg transition-colors hover:bg-surface-highlight"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="rounded-pill bg-danger px-4 py-2 text-xs font-bold text-white shadow-subtle transition-all hover:brightness-110 active:scale-95"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </nav>
  )
}






