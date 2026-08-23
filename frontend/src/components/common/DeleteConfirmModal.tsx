import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react'

export interface DeleteConfirmModalProps {
  open: boolean
  title?: string
  subtitle?: string
  description?: React.ReactNode
  itemTitle?: string
  itemSubtitle?: React.ReactNode
  confirmText?: string
  cancelText?: string
  loading?: boolean
  danger?: boolean
  icon?: 'alert' | 'trash'
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

export function DeleteConfirmModal({
  open,
  title = 'Delete item?',
  subtitle = 'This action cannot be undone.',
  description,
  itemTitle,
  itemSubtitle,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  loading = false,
  danger = true,
  icon = 'alert',
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, loading, onCancel])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
      role="presentation"
    >
      {/* Backdrop click */}
      <div
        className="absolute inset-0"
        onClick={() => {
          if (!loading) onCancel()
        }}
        aria-hidden="true"
      />

      {/* Dialog card */}
      <div
        className="relative w-full max-w-md rounded-3xl border border-border bg-surface p-5 sm:p-6 shadow-hover animate-fade-in z-10"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        aria-describedby="delete-confirm-desc"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                danger ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'
              }`}
            >
              {icon === 'trash' ? (
                <Trash2 className="h-5 w-5" aria-hidden="true" />
              ) : (
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              )}
            </div>
            <div>
              <h2
                id="delete-confirm-title"
                className="text-base font-bold text-fg leading-tight"
              >
                {title}
              </h2>
              {subtitle && (
                <p className="mt-0.5 text-xs text-fg-muted">{subtitle}</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex h-8 w-8 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-surface-highlight hover:text-fg cursor-pointer disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Optional Item Highlight Box */}
        {(itemTitle || itemSubtitle) && (
          <div className="mt-4 rounded-xl border border-border/80 bg-surface-highlight/40 p-3 text-xs">
            {itemTitle && (
              <p className="font-semibold text-fg truncate">{itemTitle}</p>
            )}
            {itemSubtitle && (
              <div className="mt-1 text-[11px] text-fg-muted leading-relaxed">
                {itemSubtitle}
              </div>
            )}
          </div>
        )}

        {/* Description Body */}
        {description && (
          <div
            id="delete-confirm-desc"
            className="mt-3 text-xs sm:text-sm leading-relaxed text-fg-secondary"
          >
            {description}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-pill border border-border bg-surface px-4 py-2 text-xs font-semibold text-fg transition-colors hover:bg-surface-highlight cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex items-center gap-1.5 rounded-pill px-4 py-2 text-xs font-bold text-white shadow-subtle transition-all active:scale-95 cursor-pointer disabled:opacity-50 ${
              danger
                ? 'bg-danger hover:bg-danger/90'
                : 'bg-primary hover:bg-primary/90'
            }`}
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default DeleteConfirmModal
