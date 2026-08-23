import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Square } from 'lucide-react'
import { useTask } from '../../hooks/useTask'
import { DeleteConfirmModal } from './DeleteConfirmModal'

const taskLabels: Record<string, string> = {
  chat: 'AI chat is thinking…',
  compare: 'Comparing documents…',
  document: 'Processing document…',
}

const taskRoutes: Record<string, string> = {
  chat: '/chat',
  compare: '/compare',
  document: '/documents',
}

const taskStopLabels: Record<string, string> = {
  chat: 'AI chat',
  compare: 'document comparison',
  document: 'document processing',
}

export function GlobalTaskIndicator() {
  const { currentTask, cancelTask } = useTask()
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (currentTask.status !== 'running' || !currentTask.type) {
    return null
  }

  const label = taskLabels[currentTask.type] || 'Working…'
  const route = taskRoutes[currentTask.type] || '/'
  const stopLabel = taskStopLabels[currentTask.type] || 'task'

  return (
    <>
      <div className="fixed right-4 top-4 z-50 flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-2.5 shadow-card animate-fade-in">
        <Loader2 className="h-4 w-4 animate-spin text-accent" />
        <span className="text-xs font-semibold text-primary">{label}</span>
        <Link
          to={route}
          className="text-xs font-bold text-accent hover:text-primary hover:underline"
        >
          View
        </Link>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          aria-label="Stop task"
          className="flex h-5 w-5 items-center justify-center rounded-md border border-danger text-danger hover:bg-danger/10"
        >
          <Square className="h-2.5 w-2.5 fill-current" />
        </button>
      </div>

      <DeleteConfirmModal
        open={confirmOpen}
        title="Stop running task?"
        subtitle="This will cancel the ongoing process."
        description={`Are you sure you want to stop the current ${stopLabel}? The work done so far may be discarded.`}
        confirmText="Stop Task"
        cancelText="Keep Running"
        danger={false}
        icon="alert"
        onConfirm={() => {
          cancelTask()
          setConfirmOpen(false)
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
