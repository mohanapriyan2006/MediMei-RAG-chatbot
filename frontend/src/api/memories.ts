import { apiFetch } from './client'

export interface UserMemory {
  memory_id: string
  user_id: string
  content: string
  created_at?: string
  updated_at?: string
}

export async function getMemoriesRequest(): Promise<UserMemory[]> {
  return apiFetch<UserMemory[]>('/api/v1/memories')
}

export async function createMemoryRequest(content: string): Promise<UserMemory> {
  return apiFetch<UserMemory>('/api/v1/memories', {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

export async function deleteMemoryRequest(memoryId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/memories/${memoryId}`, {
    method: 'DELETE',
  })
}

export async function clearMemoriesRequest(): Promise<void> {
  return apiFetch<void>('/api/v1/memories/clear', {
    method: 'POST',
  })
}

export async function toggleMemoryRequest(memoryEnabled: boolean): Promise<{ memory_enabled: boolean }> {
  return apiFetch<{ memory_enabled: boolean }>('/api/v1/memories/toggle', {
    method: 'POST',
    body: JSON.stringify({ memory_enabled: memoryEnabled }),
  })
}
