/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { ChatMessage, Citation } from '../types/chat'
import { useConversations } from '../hooks/useConversations'
import { useTask } from '../hooks/useTask'
import { useDocuments } from '../hooks/useDocuments'
import { streamChat } from '../services/groq'
import { searchDocuments } from '../services/search'
import { getMessages, saveMessages } from '../services/conversationStore'

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

function toCitations(results: ReturnType<typeof searchDocuments>): Citation[] {
  return results.slice(0, 3).map((r, idx) => ({
    citationId: `${r.documentId}-c${idx}`,
    documentId: r.documentId,
    documentName: r.documentName,
    page: 1,
    text: r.text,
  }))
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null)
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [conversationTitle, setConversationTitle] = useState<string | null>(null)

  const { activeConversationId, setConversations, setActiveConversationId } = useConversations()
  const { currentTask, startTask } = useTask()
  const { documents } = useDocuments()

  const isLoading = currentTask.type === 'chat' && currentTask.status === 'running'

  // Clear messages when no active conversation
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([])
      setSelectedCitation(null)
      setSelectedMessageId(null)
      setConversationTitle(null)
    }
  }, [activeConversationId])

  // Load messages when a conversation is selected
  useEffect(() => {
    if (!activeConversationId || isLoading) return
    const loaded = getMessages(activeConversationId)
    setMessages(loaded)
  }, [activeConversationId, isLoading])

  // Persist messages when they change
  useEffect(() => {
    if (!activeConversationId || messages.length === 0) return
    const title = conversationTitle || messages[0]?.content.slice(0, 50) + (messages[0] && messages[0].content.length > 50 ? '…' : '')
    const summary = {
      id: activeConversationId,
      title,
      updatedAt: new Date().toISOString(),
    }
    saveMessages(activeConversationId, messages, summary)
    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== activeConversationId)
      return [summary, ...filtered]
    })
  }, [activeConversationId, conversationTitle, messages, setConversations])

  const sendMessage = (content: string, documentIds?: string[]) => {
    const lowercased = content.trim().toLowerCase()
    if (!lowercased || isLoading) return

    const userMessage: ChatMessage = {
      id: makeId(),
      role: 'user',
      content: lowercased,
    }
    setMessages((prev) => [...prev, userMessage])

    void startTask(
      'chat',
      { message: lowercased, documentIds },
      async (signal) => {
        let sessionId = activeConversationId

        if (!sessionId) {
          sessionId = crypto.randomUUID()
          const title = lowercased.slice(0, 30) + (lowercased.length > 30 ? '…' : '')
          setConversationTitle(title)
          const summary = { id: sessionId, title, updatedAt: new Date().toISOString() }
          setConversations((prev) => [summary, ...prev])
          setActiveConversationId(sessionId)
          window.history.replaceState(null, '', `/chat/${sessionId}`)
        }

        const selectedDocs = documentIds
          ? documents.filter((d) => documentIds.includes(d.id) && d.status === 'ready')
          : documents.filter((d) => d.status === 'ready')

        const results = searchDocuments(lowercased, selectedDocs, 5)
        const citations = toCitations(results)

        const systemPrompt = `You are MediMei, a pharmaceutical reference assistant. Use only the uploaded document excerpts provided in the user message to answer. If the context does not contain enough information, say so clearly and do not make up facts. Cite the relevant document name in brackets like [Document Name]. Keep answers concise and clinical.`

        const promptText =
          results.length > 0
            ? `Context from uploaded documents:\n\n${results
                .map((r, idx) => `[Source ${idx + 1}: ${r.documentName}]\n${r.text}`)
                .join('\n\n---\n\n')}\n\nQuestion: ${lowercased}`
            : `No documents have been uploaded. The user asked: ${lowercased}\n\nPlease answer only if it is safe general medical knowledge, otherwise ask the user to upload a document.`

        const assistantMessageId = makeId()
        const assistantMessage: ChatMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          citations,
          status: results.length > 0 ? 'grounded' : 'insufficient_evidence',
        }
        setMessages((prev) => [...prev, assistantMessage])

        let fullText = ''
        try {
          for await (const token of streamChat(
            [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: promptText },
            ],
            signal,
          )) {
            fullText += token
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMessageId ? { ...m, content: fullText } : m)),
            )
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Failed to get a response.'
          toast.error(errorMsg)
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? { ...m, content: `Sorry, I could not generate a response. ${errorMsg}`, status: 'insufficient_evidence' }
                : m,
            ),
          )
          throw err
        }

        setSelectedMessageId(assistantMessageId)
        if (citations.length > 0) {
          setSelectedCitation(citations[0])
        }

        return assistantMessage
      },
    )
  }

  const clearChat = () => {
    setMessages([])
    setSelectedCitation(null)
    setSelectedMessageId(null)
    setConversationTitle(null)
    setActiveConversationId(null)
  }

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