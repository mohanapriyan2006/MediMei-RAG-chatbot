/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { ChatMessage, Citation } from '../types/chat'
import { useConversations } from '../hooks/useConversations'
import { useTask } from '../hooks/useTask'
import { sendMessage as sendChatMessage } from '../api/chat'
import { createSession, getSession, toConversationSummary } from '../api/sessions'

interface ChatContextValue {
  messages: ChatMessage[]
  isLoading: boolean
  sendMessage: (content: string, documentIds?: string[]) => void
  clearChat: () => void
  selectedCitation: Citation | null
  setSelectedCitation: (c: Citation | null) => void
  selectedMessageId: string | null
  setSelectedMessageId: (id: string | null) => void
  activeCitations: Citation[]
}

export const ChatContext = createContext<ChatContextValue | null>(null)

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function mapCitations(raw: unknown[] | undefined): Citation[] {
  if (!raw) return []
  return (raw as Record<string, unknown>[]).map((c, idx) => ({
    citationId: String(c.citation_id || c.chunk_id || `c-${idx}`),
    documentId: String(c.document_id || ''),
    documentName: String(c.document_name || 'Unknown Document'),
    page: Number(c.page ?? c.page_no ?? 0),
    section: c.section_title as string | undefined || c.section as string | undefined,
    text: c.text as string | undefined,
    score: c.score as number | undefined,
  }))
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null)
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)

  const { activeConversationId, setConversations, setActiveConversationId } = useConversations()
  const { currentTask, startTask } = useTask()

  // Clear messages when no active conversation
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([])
      setSelectedCitation(null)
      setSelectedMessageId(null)
    }
  }, [activeConversationId])

  const isLoading = currentTask.type === 'chat' && currentTask.status === 'running'

  // Load messages when a conversation is selected
  useEffect(() => {
    if (!activeConversationId) return
    if (isLoading) return
    const load = async () => {
      try {
        const session = await getSession(activeConversationId)
        const loaded: ChatMessage[] = session.messages.map((msg) => ({
          id: String(msg.message_id),
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          thinking: msg.thinking || undefined,
          citations: mapCitations(msg.citations),
          status: msg.role === 'assistant' ? 'grounded' : undefined,
          memoriesUpdated: msg.memories_updated || undefined,
          memoriesUsed: msg.memories_used || undefined,
        }))
        setMessages(loaded)
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to load chat')
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId])

  const sendMessage = (content: string, documentIds?: string[]) => {
    const lowercased = content.trim().toLowerCase()
    if (!lowercased || isLoading) return

    void startTask(
      'chat',
      { message: lowercased, documentIds },
      async (signal) => {
        const userMessage: ChatMessage = {
          id: makeId(),
          role: 'user',
          content: lowercased,
        }
        setMessages((prev) => [...prev, userMessage])

        let sessionId = activeConversationId

        if (!sessionId) {
          const title = lowercased.slice(0, 30) + (lowercased.length > 30 ? '…' : '')
          const session = await createSession(title, signal)
          sessionId = String(session.session_id)
          setConversations((prev) => [toConversationSummary(session), ...prev])
          setActiveConversationId(sessionId)
          window.history.replaceState(null, '', `/chat/${sessionId}`)
        }

        const response = await sendChatMessage(
          {
            message: lowercased,
            session_id: sessionId,
            document_ids: documentIds,
          },
          signal,
        )

        const assistantMessage: ChatMessage = {
          id: String(response.message_id),
          role: 'assistant',
          content: response.answer,
          thinking: response.thinking || undefined,
          citations: mapCitations(response.citations as unknown[]),
          status: response.grounded ? 'grounded' : 'insufficient_evidence',
          memoriesUpdated: response.memories_updated || undefined,
          memoriesUsed: response.memories_used || undefined,
        }

        setMessages((prev) => [...prev, assistantMessage])
        setSelectedMessageId(assistantMessage.id)
        if (assistantMessage.citations && assistantMessage.citations.length > 0) {
          setSelectedCitation(assistantMessage.citations[0])
        }

        return assistantMessage
      },
    )
  }
  const clearChat = () => {
    setMessages([])
    setSelectedCitation(null)
    setSelectedMessageId(null)
    setActiveConversationId(null)
  }

  // Active citations computed from selected message or latest assistant message
  const activeMessage = selectedMessageId
    ? messages.find((m) => m.id === selectedMessageId)
    : [...messages].reverse().find((m) => m.role === 'assistant')

  const activeCitations = activeMessage?.citations || []

  return (
    <ChatContext.Provider
      value={{
        messages,
        isLoading,
        sendMessage,
        clearChat,
        selectedCitation,
        setSelectedCitation,
        selectedMessageId,
        setSelectedMessageId,
        activeCitations,
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}
