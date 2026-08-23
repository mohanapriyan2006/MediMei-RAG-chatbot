/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { ConversationSummary } from '../types/chat'
import { useAuth } from '../hooks/useAuth'
import {
  listConversations,
  deleteConversation as deleteStoredConversation,
  renameConversation as renameStoredConversation,
} from '../services/conversationStore'

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
  const [conversations, setConversationsState] = useState<ConversationSummary[]>([])
  const [activeConversationId, setActiveConversationIdState] = useState<string | null>(null)
  const { user } = useAuth()

  const setConversations = useCallback((value: React.SetStateAction<ConversationSummary[]>) => {
    setConversationsState((prev) => {
      const next = typeof value === 'function' ? (value as (prev: ConversationSummary[]) => ConversationSummary[])(prev) : value
      localStorage.setItem('medimei_conversations_v1', JSON.stringify(next))
      return next
    })
  }, [])

  const setActiveConversationId = setActiveConversationIdState

  // Load conversations when user state changes
  useEffect(() => {
    if (!user) {
      setConversationsState([])
      setActiveConversationIdState(null)
      return
    }
    setConversationsState(listConversations())
  }, [user])

  const selectConversation = (id: string) => setActiveConversationIdState(id)

  const renameConversation = (id: string, title: string) => {
    if (!title.trim()) return
    renameStoredConversation(id, title.trim())
    setConversationsState((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: title.trim(), updatedAt: new Date().toISOString() } : c)),
    )
  }

  const deleteConversation = (id: string) => {
    deleteStoredConversation(id)
    setConversationsState((prev) => prev.filter((c) => c.id !== id))
    setActiveConversationIdState((prev) => (prev === id ? null : prev))
    toast.success('Chat deleted')
  }

  const newConversation = () => {
    setActiveConversationIdState(null)
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
        setActiveConversationId,
      }}
    >
      {children}
    </ConversationContext.Provider>
  )
}