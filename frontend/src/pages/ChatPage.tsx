import { useState } from 'react'
import { PanelRightOpen } from 'lucide-react'
import { ChatLayout } from '../components/layout/ChatLayout'
import { ChatWindow } from '../components/chat/ChatWindow'
import { PromptBar } from '../components/chat/PromptBar'
import { EvidencePanel } from '../components/evidence/EvidencePanel'
import { useUI } from '../hooks/useUI'
import { useChat } from '../hooks/useChat'

export default function ChatPage() {
  const [evidenceDrawerOpen, setEvidenceDrawerOpen] = useState(false)
  const { isMobile } = useUI()
  const { activeCitations } = useChat()

  const openEvidence = () => {
    if (isMobile) setEvidenceDrawerOpen(true)
  }

  return (
    <ChatLayout>
      <div className="flex h-full w-full overflow-hidden">
        {/* CENTER COLUMN: Chat Header, Conversation, Input */}
        <div className="flex min-w-0 flex-1 flex-col h-full overflow-hidden">

          {/* Conversation Stream */}
          <ChatWindow onOpenEvidence={openEvidence} />

          {/* Sticky Bottom Prompt Input */}
          <div className="bg-transparent p-2 sm:p-4 backdrop-blur-xs">
            <div className="mx-auto w-full max-w-3xl">
              <PromptBar />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Evidence / Source Verification Panel (Desktop >= 1280px) */}
        <div className="hidden xl:block w-80 2xl:w-96 shrink-0 h-full">
          <EvidencePanel />
        </div>

        {/* Mobile / Tablet Evidence Drawer Modal */}
        {evidenceDrawerOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs xl:hidden">
            <div className="h-full w-full max-w-md bg-surface shadow-2xl">
              <EvidencePanel isMobileDrawer onClose={() => setEvidenceDrawerOpen(false)} />
            </div>
          </div>
        )}

        {/* Mobile evidence sliver trigger */}
        {isMobile && activeCitations.length > 0 && !evidenceDrawerOpen && (
          <button
            type="button"
            onClick={() => setEvidenceDrawerOpen(true)}
            aria-label={`View ${activeCitations.length} source${activeCitations.length === 1 ? '' : 's'}`}
            className="fixed right-0 top-1/2 z-30 -translate-y-1/2 rounded-l-2xl bg-primary px-2 py-3 text-white shadow-card transition-transform active:scale-95"
          >
            <PanelRightOpen className="h-5 w-5" />
          </button>
        )}
      </div>
    </ChatLayout>
  )
}

