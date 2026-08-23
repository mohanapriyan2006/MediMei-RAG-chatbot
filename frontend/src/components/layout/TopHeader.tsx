import { Menu, Moon, Sun } from 'lucide-react'
import { useUI } from '../../hooks/useUI'
import { useConversations } from '../../hooks/useConversations'
import { useTheme } from '../../hooks/useTheme'

interface TopHeaderProps {
  title?: string
}

export function TopHeader({ title }: TopHeaderProps) {
  const { toggleSidebar } = useUI()
  const { activeConversationId, conversations } = useConversations()
  const { theme, toggleTheme } = useTheme()

  const activeConversation = conversations.find((c) => c.id === activeConversationId)
  const displayTitle = title || activeConversation?.title || 'Clinical Intelligence'

  return (
    <header className="flex h-11 w-full shrink-0 items-center justify-between border-b border-border bg-[var(--header-bg,var(--sidebar-bg))] px-4 lg:px-6 select-none">
      {/* Left: Mobile Menu Toggle + Scoped Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex h-7 w-7 items-center justify-center rounded-[6px] text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary lg:hidden cursor-pointer shrink-0"
          aria-label="Toggle navigation"
          title="Toggle navigation"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <span className="font-sans text-xs sm:text-[13px] font-bold text-text-primary">
            LabelProof
          </span>
          <span className="text-[10px] text-text-tertiary font-mono">/</span>
          <h1 className="font-sans text-xs text-text-secondary truncate">
            {displayTitle}
          </h1>
        </div>
      </div>

      {/* Right: Subtle Status Indicator & Theme Toggle */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-badge-evidence)] px-2.5 py-0.5 text-[10.5px] font-mono font-bold text-[#0891B2] dark:text-[#22D3E8] border border-[var(--border-badge-evidence)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#20C7DC] dark:bg-[#22D3E8]" />
          <span>Evidence-backed</span>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-7 w-7 items-center justify-center rounded-[6px] text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary border border-border cursor-pointer"
          aria-label={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
          title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
        >
          {theme === 'dark' ? (
            <Sun className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          ) : (
            <Moon className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          )}
        </button>
      </div>
    </header>
  )
}














