export type DocumentStatus = 'processing' | 'ready' | 'failed'

export interface Document {
  id: string
  name: string
  filename: string
  status: DocumentStatus
  fileSize: number
  uploadedAt: string
  pageCount?: number
  source?: string
  version?: string
  isActive?: boolean
  stage?: string
  progress?: number
  progressDetail?: string
}
