import { FileText, Plus, Brain } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useChat } from '../../hooks/useChat'
import { useConversations } from '../../hooks/useConversations'
import { useDocuments } from '../../hooks/useDocuments'
import { useUI } from '../../hooks/useUI'
import { SidebarHeader } from './SidebarHeader'
import { RecentChats } from './RecentChats'
import { UserProfile } from './UserProfile'
import ThemeToggle from '../common/ThemeToggle'
import { ThemeToggle as ThemeToggleLong } from './ThemeToggle'

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const { clearChat } = useChat()
  const { newConversation } = useConversations()
  const { sidebarCollapsed } = useUI()
  const navigate = useNavigate();
  useDocuments()
  const location = useLocation()
  const collapsed = sidebarCollapsed

  const handleNewChat = () => {
    clearChat();
    newConversation();
    navigate('/');
    onClose?.();
  }

  if (collapsed) {
    return (
      <aside className="sticky top-0 flex h-screen w-14 flex-col items-center border-r border-border bg-surface py-2 shadow-subtle">
        <SidebarHeader onClose={onClose} collapsed />
        <div className="mt-2 flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={handleNewChat}
            className="flex h-9 w-9 items-center justify-center rounded-2xl text-primary transition-colors hover:bg-surface-highlight"
            aria-label="New clinical inquiry"
            title="New Chat"
          >
            <Plus className="h-5 w-5" />
          </button>
        
          <Link
            to="/documents"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-2xl text-fg-muted transition-colors hover:bg-surface-highlight hover:text-primary"
            aria-label="Manage documents"
            title="Manage Documents"
          >
            <FileText className="h-5 w-5" />
          </Link>

          <Link
            to="/memories"
            onClick={onClose}
            className={`flex h-9 w-9 items-center justify-center rounded-2xl transition-colors hover:bg-surface-highlight ${location.pathname === '/memories' ? 'bg-surface-highlight text-primary' : 'text-fg-muted hover:text-primary'}`}
            aria-label="AI Memory"
            title="AI Memory"
          >
            <Brain className="h-5 w-5" />
          </Link>
        </div>
        <div className="mt-4 flex-1" />
        <ThemeToggle size="sm" />
        <UserProfile collapsed />
      </aside>
    )
  }

  return (
    <aside className="sticky top-0 flex h-screen w-64 flex-col border-r border-border bg-surface shadow-subtle">
      <SidebarHeader onClose={onClose} collapsed={false} />

      <div className="flex flex-col gap-1.5 px-3 pt-3">
        <button
          type="button"
          onClick={handleNewChat}
          className="flex w-full items-center gap-2 rounded-pill bg-primary px-3.5 py-2 text-xs font-bold text-white shadow-subtle hover:bg-primary-hover transition-all"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>New Chat</span>
        </button>

        <Link
          to="/documents"
          onClick={onClose}
          className={`flex w-full items-center justify-between rounded-2xl px-3 py-2 text-xs font-semibold transition-colors ${location.pathname === '/documents' ? 'bg-surface-highlight text-primary' : 'text-fg hover:bg-surface-highlight'}`}
        >
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-accent" />
            <span>Manage Documents</span>
          </div>
        </Link>

        <Link
          to="/memories"
          onClick={onClose}
          className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold transition-colors ${location.pathname === '/memories' ? 'bg-surface-highlight text-primary' : 'text-fg hover:bg-surface-highlight'}`}
        >
          <Brain className="h-4 w-4 shrink-0 text-accent" />
          <span>Memory</span>
        </Link>
      </div>

      <div className="mt-3 flex-1 overflow-y-auto px-2">
        <div className="px-2 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-wider text-fg-muted">
          Recent Consultations
        </div>
        <RecentChats collapsed={false} />
      </div>

      <ThemeToggleLong />

      <div className="border-t border-border p-2">
        <UserProfile collapsed={false} />
      </div>
    </aside>
  )
}

export default Sidebar
