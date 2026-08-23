export type AnswerStatus = 'grounded' | 'insufficient_evidence'

export interface Citation {
  citationId: string
  documentId: string
  documentName: string
  page: number
  section?: string
  text?: string
  score?: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  citations?: Citation[]
  followUps?: string[]
  status?: AnswerStatus
  memoriesUpdated?: string[]
  memoriesUsed?: string[]
}

export interface ChatResponse {
  conversationId?: string
  message_id: string
  session_id: string
  answer: string
  thinking?: string
  grounded: boolean
  evidence_count?: number
  citations: Citation[]
  followUps?: string[]
  memories_updated?: string[]
  memories_used?: string[]
}

export interface ChatRequest {
  message: string
  session_id: string
  document_ids?: string[]
}

export interface Conversation {
  id: string
  title: string
  updatedAt: string
  messages: ChatMessage[]
}

export interface ConversationSummary {
  id: string
  title: string
  updatedAt: string
}
