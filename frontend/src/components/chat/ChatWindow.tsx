import { useEffect, useRef } from 'react'
import { Pill, AlertTriangle, Clock, Layers } from 'lucide-react'
import { useChat } from '../../hooks/useChat'
import { ChatMessage } from './ChatMessage'
import { LoadingState } from './LoadingState'

interface ChatWindowProps {
  onOpenEvidence?: () => void
}

export function ChatWindow({ onOpenEvidence }: ChatWindowProps) {
  const { messages, isLoading, sendMessage } = useChat()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const suggestions = [
    {
      icon: Clock,
      label: 'Dosage & Administration',
      query: 'What is the recommended dosage and administration schedule?',
    },
    {
      icon: AlertTriangle,
      label: 'Boxed Warnings',
      query: 'What are the major boxed warnings and precautions for this drug?',
    },
    {
      icon: Pill,
      label: 'Contraindications',
      query: 'What are the contraindications and high-risk patient groups?',
    },
    {
      icon: Layers,
      label: 'Adverse Reactions',
      query: 'What are the most common adverse reactions reported in clinical trials?',
    },
  ]

  return (
    <div className="flex-1 overflow-y-auto">
      {messages.length === 0 ? (
        <div className="flex min-h-full flex-col relative overflow-hidden items-center justify-center px-6 py-12 text-center">
          <div className="mb-5 relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white shadow-subtle transition-all duration-200 group-hover:shadow-card">
              <img src="/logo.png" alt="MediMei" className="h-15 w-15 object-contain" />
            </div>
            <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-success border-2 border-background">
              <span className="block h-2 w-2 rounded-full bg-white animate-pulse" />
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">
            MediMei AI Assistant
          </h1>


          {/* Suggestion chips */}
          <div className="mt-10 grid grid-cols-1 gap-2.5 sm:grid-cols-2 max-w-lg w-full">
            {suggestions.map((sug) => {
              const Icon = sug.icon
              return (
                <button
                  key={sug.label}
                  type="button"
                  onClick={() => sendMessage(sug.query)}
                  className="group  flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-left shadow-subtle transition-all duration-200 hover:border-primary/30 hover:shadow-card hover:-translate-y-0.5"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-surface-highlight text-primary border border-border transition-colors group-hover:bg-primary/8 group-hover:border-primary/20">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-bold text-primary">{sug.label}</span>
                    <span className="mt-0.5 block text-[11px] text-fg-muted line-clamp-1">{sug.query}</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Low opacity subtle medicine.png background element */}
          <img
            src="/logo.png"
            alt=""
            className="absolute -right-[15%] -bottom-[20%] h-[440px] w-auto object-contain opacity-[5%] -z-9 pointer-events-none"
          />

        </div>

      ) : (
        <div className="mx-auto max-w-3xl space-y-7 px-4 py-8 pb-6 sm:px-6 lg:px-8">
          {messages.map((message, index) => (
            <ChatMessage
              key={message.id}
              message={message}
              isLast={index === messages.length - 1}
              onOpenEvidence={onOpenEvidence}
            />
          ))}
          {isLoading && <LoadingState />}
          <div ref={bottomRef} aria-hidden="true" className="h-2" />
        </div>
      )}


    </div>
  )
}

export default ChatWindow
