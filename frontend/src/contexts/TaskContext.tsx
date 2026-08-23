/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { apiFetch } from '../api/client'
import type { TaskState, TaskType } from '../types/task'

const STORAGE_KEY = 'medimei-current-task'

interface TaskContextValue {
  currentTask: TaskState
  startTask: <T>(
    type: NonNullable<TaskType>,
    payload: Record<string, unknown>,
    runner: (signal: AbortSignal) => Promise<T>,
  ) => Promise<boolean>
  cancelTask: () => void
  completeTask: (result?: unknown) => void
  failTask: (error: string) => void
  resetTask: () => void
}

export const TaskContext = createContext<TaskContextValue | null>(null)

function getInitialTask(): TaskState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { type: null, status: 'idle' }
    const parsed: TaskState = JSON.parse(raw)
    if (parsed.status === 'running') {
      return {
        ...parsed,
        status: 'error',
        error: 'The task was interrupted (page reloaded). Please retry.',
      }
    }
    return parsed
  } catch {
    return { type: null, status: 'idle' }
  }
}

export function TaskProvider({ children }: { children: ReactNode }) {
  const [currentTask, setCurrentTask] = useState<TaskState>(getInitialTask)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (currentTask.status === 'idle') {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentTask))
    }
  }, [currentTask])

  const startTask = useCallback(
    async <T,>(
      type: NonNullable<TaskType>,
      payload: Record<string, unknown>,
      runner: (signal: AbortSignal) => Promise<T>,
    ): Promise<boolean> => {
      if (currentTask.status === 'running') {
        return false
      }

      const controller = new AbortController()
      abortControllerRef.current = controller

      const taskId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      ;(window as unknown as Record<string, string | null>).__medimeiTaskId = taskId

      const payloadWithId = { ...payload, taskId }

      setCurrentTask({
        type,
        status: 'running',
        payload: payloadWithId,
      })

      try {
        const result = await runner(controller.signal)
        if (controller.signal.aborted) {
          return false
        }
        setCurrentTask({
          type,
          status: 'success',
          payload,
          result,
        })
      } catch (err: unknown) {
        if (err instanceof Error && (err.name === 'AbortError' || controller.signal.aborted)) {
          setCurrentTask({
            type,
            status: 'error',
            payload,
            error: 'Cancelled by user',
          })
          return false
        }
        setCurrentTask({
          type,
          status: 'error',
          payload,
          error: err instanceof Error ? err.message : 'Task failed.',
        })
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null
        }
        ;(window as unknown as Record<string, string | null>).__medimeiTaskId = null
      }

      return true
    },
    [currentTask.status],
  )

  const cancelTask = useCallback(async () => {
    const taskId = (typeof window !== 'undefined' && (window as unknown as Record<string, string | undefined>).__medimeiTaskId) as string | undefined
    if (!taskId) return

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    try {
      await apiFetch<void>(`/api/v1/tasks/${taskId}/cancel`, { method: 'POST' })
    } catch {
      // Ignore network errors — the abort controller already stops the UI.
    }
  }, [])

  const completeTask = useCallback((result?: unknown) => {
    setCurrentTask((prev) =>
      prev.type
        ? { ...prev, status: 'success', result }
        : { type: null, status: 'idle' },
    )
  }, [])

  const failTask = useCallback((error: string) => {
    setCurrentTask((prev) =>
      prev.type
        ? { ...prev, status: 'error', error }
        : { type: null, status: 'idle' },
    )
  }, [])

  const resetTask = useCallback(() => {
    setCurrentTask({ type: null, status: 'idle' })
  }, [])

  return (
    <TaskContext.Provider
      value={{
        currentTask,
        startTask,
        cancelTask,
        completeTask,
        failTask,
        resetTask,
      }}
    >
      {children}
    </TaskContext.Provider>
  )
}
