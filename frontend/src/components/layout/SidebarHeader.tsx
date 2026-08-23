import { PanelLeftClose, PanelLeftOpen, Search, X } from 'lucide-react'

import { useUI } from '../../hooks/useUI'
import { Tooltip } from '../common/Tooltip'
import { GlobalSearchPanel } from './GlobalSearchPanel'

interface SidebarHeaderProps {
  onClose?: () => void
  collapsed: boolean
}

export function SidebarHeader({ onClose, collapsed }: SidebarHeaderProps) {
  const { toggleCollapse, toggleSearch, searchOpen } = useUI()

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white shadow-subtle transition-all duration-200 group-hover:shadow-card">
            <img src="/logo.png" alt="MediMei" className="h-10 w-10 object-contain" />
          </div>

        <Tooltip content="Expand sidebar" side="right">
          <button
            type="button"
            onClick={toggleCollapse}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-highlight hover:text-fg"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between px-3 py-3">
      <div className="flex items-center gap-2">
         <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white shadow-subtle transition-all duration-200 group-hover:shadow-card">
            <img src="/logo.png" alt="MediMei" className="h-10 w-10 object-contain" />
          </div>
        <div className="leading-none">
          <div className="text-base font-semibold text-fg">MediMei</div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-accent">Clinical AI</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5">

        <button
          type="button"
          onClick={toggleSearch}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${searchOpen ? 'bg-surface-highlight text-primary' : 'text-fg-muted hover:bg-surface-highlight hover:text-fg'}`}
          aria-label="Search conversations and documents"
          title="Search"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={toggleCollapse}
          className="hidden h-6 w-6 items-center justify-center rounded-[6px] text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary lg:flex cursor-pointer"
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="h-3.5 w-3.5" aria-hidden="true" />
        </button>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-[6px] text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary lg:hidden cursor-pointer"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <GlobalSearchPanel />
    </div>
  )

}






