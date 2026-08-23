import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { LogOut, AlertTriangle, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

interface UserProfileProps {
  collapsed: boolean
}

function LogoutConfirmModal({
  open,
  onCancel,
  onConfirm,
  displayName,
}: {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
  displayName: string
}) {
  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Confirm logout"
    >
      <div
        className="relative w-full max-w-sm rounded-3xl border border-border bg-surface p-6 shadow-hover animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-surface-highlight hover:text-fg"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
            <AlertTriangle className="h-7 w-7" />
          </div>

          <h3 className="text-lg font-bold text-fg">Confirm Logout</h3>
          <p className="mt-2 text-sm leading-relaxed text-fg-secondary">
            Are you sure you want to log out
            {displayName !== 'User' ? (
              <>
                {' '}as <span className="font-semibold text-fg">{displayName}</span>
              </>
            ) : null}
            ? You will need to sign in again to continue.
          </p>

          <div className="mt-6 flex w-full gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-pill border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-fg transition-colors hover:bg-surface-highlight"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 rounded-pill bg-danger px-4 py-2.5 text-sm font-bold text-white shadow-subtle transition-all hover:bg-danger/90 active:scale-[0.98]"
            >
              <span className="inline-flex items-center gap-1.5">
                <LogOut className="h-3.5 w-3.5" />
                Log out
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function UserProfile({ collapsed }: UserProfileProps) {
  const { user, logout } = useAuth()
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  const displayName = useMemo(() => {
    const candidates = [user?.name, user?.full_name, user?.username, user?.display_name]
    const resolved = candidates.find((value): value is string => Boolean(value && value.trim()))
    if (resolved) return resolved.trim()
    if (user?.email) return user.email.split('@')[0]
    return 'User'
  }, [user])

  const subtitle = user?.role ? user.role.replace(/_/g, ' ') : 'MediMei User'
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U'

  const handleLogout = () => {
    setShowLogoutModal(false)
    logout()
  }

  if (collapsed) {
    return (
      <>
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-subtle">
            <span className="text-xs font-bold">{initials}</span>
          </div>
          <button
            type="button"
            onClick={() => setShowLogoutModal(true)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-danger/10 hover:text-danger"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
        <LogoutConfirmModal
          open={showLogoutModal}
          onCancel={() => setShowLogoutModal(false)}
          onConfirm={handleLogout}
          displayName={displayName}
        />
      </>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between rounded-2xl px-2 py-2 transition-colors hover:bg-surface-highlight">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-subtle">
            <span className="text-xs font-bold">{initials}</span>
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-fg">{displayName}</div>
            <div className="truncate text-xs text-fg-muted">{subtitle}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowLogoutModal(true)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-danger/10 hover:text-danger"
          aria-label="Log out"
          title="Log out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
      <LogoutConfirmModal
        open={showLogoutModal}
        onCancel={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        displayName={displayName}
      />
    </>
  )
}







