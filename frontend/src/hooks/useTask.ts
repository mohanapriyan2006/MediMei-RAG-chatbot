import { useContext } from 'react'
import { TaskContext } from '../contexts/TaskContext'

export function useTask() {
  const context = useContext(TaskContext)
  if (!context) {
    throw new Error('useTask must be used within a TaskProvider')
  }
  return context
}
