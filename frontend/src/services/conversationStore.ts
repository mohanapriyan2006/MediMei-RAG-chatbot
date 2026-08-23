import type { ConversationSummary, ChatMessage } from '../types/chat'

const KEY = 'medimei_conversations_v1'
const messagesKey = (id: string) => `${KEY}:${id}:messages`

export function listConversations(): ConversationSummary[] {
  const raw = localStorage.getItem(KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as ConversationSummary[]
  } catch {
    return []
  }
}

export function saveConversationSummary(summary: ConversationSummary): void {
  const conversations = listConversations()
  const filtered = conversations.filter((c) => c.id !== summary.id)
  const next = [summary, ...filtered]
  localStorage.setItem(KEY, JSON.stringify(next))
}

export function getMessages(id: string): ChatMessage[] {
  const raw = localStorage.getItem(messagesKey(id))
  if (!raw) return []
  try {
    return JSON.parse(raw) as ChatMessage[]
  } catch {
    return []
  }
}

export function saveMessages(
  id: string,
  messages: ChatMessage[],
  summary?: ConversationSummary,
): void {
  localStorage.setItem(messagesKey(id), JSON.stringify(messages))
  if (summary) {
    saveConversationSummary(summary)
  }
}

export function deleteConversation(id: string): void {
  const conversations = listConversations().filter((c) => c.id !== id)
  localStorage.setItem(KEY, JSON.stringify(conversations))
  localStorage.removeItem(messagesKey(id))
}

export function renameConversation(id: string, title: string): void {
  const conversations = listConversations()
  const idx = conversations.findIndex((c) => c.id === id)
  if (idx < 0) return
  conversations[idx] = {
    ...conversations[idx],
    title: title.trim(),
    updatedAt: new Date().toISOString(),
  }
  localStorage.setItem(KEY, JSON.stringify(conversations))
}