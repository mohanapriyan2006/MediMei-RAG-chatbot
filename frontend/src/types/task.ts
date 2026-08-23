export type TaskType = 'chat' | 'compare' | 'document' | null

export type TaskStatus = 'idle' | 'running' | 'success' | 'error'

export interface BaseTaskState {
  type: TaskType
  status: TaskStatus
  payload?: Record<string, unknown>
  result?: unknown
  error?: string
}

export interface ChatTaskPayload {
  message: string
  documentIds?: string[]
}

export interface CompareTaskPayload {
  drug1Id: string
  drug2Id: string
}

export interface DocumentTaskPayload {
  name: string
}

export type TaskState = BaseTaskState
