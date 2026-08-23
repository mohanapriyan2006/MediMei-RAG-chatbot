import { DeleteConfirmModal } from '../common/DeleteConfirmModal'
import type { Document } from '../../types/document'

interface DeleteDocumentDialogProps {
  document: Document | null
  onCancel: () => void
  onConfirm: () => void
  loading?: boolean
}

export function DeleteDocumentDialog({
  document,
  onCancel,
  onConfirm,
  loading = false,
}: DeleteDocumentDialogProps) {
  if (!document) return null

  return (
    <DeleteConfirmModal
      open={!!document}
      title="Delete document?"
      subtitle="This action cannot be undone."
      itemTitle={document.name}
      itemSubtitle={
        <span>
          {document.pageCount ? `${document.pageCount} pages • ` : ''}
          Uploaded {document.uploadedAt ? new Date(document.uploadedAt).toLocaleDateString() : 'recently'}
        </span>
      }
      description={
        <p>
          Are you sure you want to delete this document? It will be permanently removed and no longer used as a verified clinical knowledge source.
        </p>
      }
      confirmText="Delete Document"
      cancelText="Cancel"
      loading={loading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}

export default DeleteDocumentDialog
