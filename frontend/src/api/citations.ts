import { apiFetch } from './client'
import type { Citation } from '../types/chat'

export const getCitation = (citationId: string) =>
  apiFetch<Citation>(`/api/v1/citations/${encodeURIComponent(citationId)}`)
