/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { ConversationSummary } from '../types/chat'
import { useAuth } from '../hooks/useAuth'
import {
  listSessions,
  updateSession,
  deleteSession,
  toConversationSummary,
} from '../api/sessions'

interface ConversationContextValue {
  conversations: ConversationSummary[]
  activeConversationId: string | null
  selectConversation: (id: string) => void
  renameConversation: (id: string, title: string) => void
  deleteConversation: (id: string) => void
  newConversation: () => void
  setConversations: React.Dispatch<React.SetStateAction<ConversationSummary[]>>
  setActiveConversationId: React.Dispatch<React.SetStateAction<string | null>>
}

export const ConversationContext = createContext<ConversationContextValue | null>(null)

export function ConversationProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const { user } = useAuth()

  // Load conversations when user state changes
  useEffect(() => {
    if (!user) {
      setConversations([])
      setActiveConversationId(null)
      return
    }

    const load = async () => {
      try {
        const res = await listSessions()
        setConversations(res.map(toConversationSummary))
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to load chat history')
      }
    }

    load()
  }, [user])

  const selectConversation = (id: string) => setActiveConversationId(id)

  const renameConversation = async (id: string, title: string) => {
    if (!title.trim()) return
    try {
      await updateSession(id, title.trim())
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: title.trim() } : c)),
      )
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to rename chat')
    }
  }

  const deleteConversation = async (id: string) => {
    try {
      await deleteSession(id)
      setConversations((prev) => prev.filter((c) => c.id !== id))
      setActiveConversationId((prev) => (prev === id ? null : prev))
      toast.success('Chat deleted')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete chat')
    }
  }

  const newConversation = () => {
    setActiveConversationId(null)
  }

  return (
    <ConversationContext.Provider
      value={{
        conversations,
        activeConversationId,
        selectConversation,
        renameConversation,
        deleteConversation,
        newConversation,
        setConversations,
        setActiveConversationId
      }}
    >
      {children}
    </ConversationContext.Provider>
  )
}
