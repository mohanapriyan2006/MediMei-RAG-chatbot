import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useDocuments } from '../../hooks/useDocuments'
import { useTask } from '../../hooks/useTask'

export function DocumentUpload() {
  const { uploadDocument } = useDocuments()
  const { currentTask } = useTask()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const isTaskRunning = currentTask.status === 'running'
  const isBlocked = isTaskRunning && currentTask.type !== 'document'

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (isTaskRunning) {
      toast.error('Another task is in progress. Please wait or switch to that page.')
      return
    }
    const file = files[0]
    const allowed = ['.pdf', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff', '.tif']
    const isAllowed = allowed.some((ext) => file.name.toLowerCase().endsWith(ext)) || file.type.startsWith('image/')
    if (!isAllowed) {
      toast.error('Only PDF, DOCX, DOC, and image files (PNG, JPG, WEBP, BMP, TIFF) are supported')
      return
    }
    uploadDocument(file)
    toast.success(`Uploading "${file.name}"…`)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div
      role="region"
      aria-label="Document upload area"
      onDragOver={(e) => {
        if (isTaskRunning) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
        dragging ? 'border-primary bg-primary/5' : 'border-border bg-surface'
      } ${isTaskRunning ? 'opacity-60' : ''}`}
    >
      {isBlocked && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-surface/80 p-6 text-center backdrop-blur-sm">
          <p className="text-sm font-semibold text-warning">
            {currentTask.type === 'compare'
              ? 'A comparison is in progress. Switch to Compare or wait.'
              : currentTask.type === 'chat'
                ? 'An AI chat is in progress. Switch to Chat or wait.'
                : 'Another task is in progress. Please wait.'}
          </p>
        </div>
      )}

      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-highlight text-primary">
        <Upload className="h-6 w-6" aria-hidden="true" />
      </div>

      {/* Copy */}
      <p className="mb-1 text-sm font-semibold text-fg">
        {dragging ? 'Drop to upload' : 'Drop PDF, DOCX, DOC, or Image files here'}
      </p>
      <p className="mb-5 text-xs text-fg-muted">
        Approved drug-label & medical documents · PDF, DOCX, DOC, PNG, JPG, WEBP format
      </p>

      {/* Button */}
      <button
        type="button"
        disabled={isTaskRunning}
        onClick={() => inputRef.current?.click()}
        className="rounded-pill bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        Upload Document
      </button>

      <input
        ref={inputRef}
        type="file"
        disabled={isTaskRunning}
        accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.webp,.bmp,.tiff,.tif,image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
        aria-label="Select PDF, DOCX, DOC, or Image file"
      />
    </div>
  )
}







