export interface UserMemory {
  memory_id: string
  user_id: string
  content: string
  created_at?: string
  updated_at?: string
}

const KEY = 'medimei_memories_v1'

export function listMemories(): UserMemory[] {
  const raw = localStorage.getItem(KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as UserMemory[]
  } catch {
    return []
  }
}

function saveMemories(memories: UserMemory[]): void {
  localStorage.setItem(KEY, JSON.stringify(memories))
}

export function createMemory(content: string, userId = 'preview-user'): UserMemory {
  const memory: UserMemory = {
    memory_id: crypto.randomUUID(),
    user_id: userId,
    content,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  const memories = [memory, ...listMemories()]
  saveMemories(memories)
  return memory
}

export function deleteMemory(memoryId: string): void {
  const memories = listMemories().filter((m) => m.memory_id !== memoryId)
  saveMemories(memories)
}

export function clearMemories(): void {
  localStorage.removeItem(KEY)
}