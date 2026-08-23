import { apiFetch } from './client'
import type { ChatRequest, ChatResponse } from '../types/chat'

export const sendMessage = (request: ChatRequest, signal?: AbortSignal) =>
  apiFetch<ChatResponse>('/api/v1/chat', { method: 'POST', body: JSON.stringify(request), signal })
