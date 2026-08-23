import { useState } from 'react'
import { toast } from 'sonner'
import { FileText, ShieldCheck } from 'lucide-react'
import { ChatLayout } from '../components/layout/ChatLayout'
import { DeleteDocumentDialog } from '../components/documents/DeleteDocumentDialog'
import { DocumentList } from '../components/documents/DocumentList'
import { DocumentViewerModal } from '../components/documents/DocumentViewerModal'
import { DocumentSearch } from '../components/documents/DocumentSearch'
import { DocumentUpload } from '../components/documents/DocumentUpload'
import { useDocuments } from '../hooks/useDocuments'
import type { Document } from '../types/document'
import medicineVerificationImage from '../assets/medicine.png.png'


export default function DocumentsPage() {
  const { deleteDocument, documents } = useDocuments()
  const [pendingDelete, setPendingDelete] = useState<Document | null>(null)
  const [viewingDocument, setViewingDocument] = useState<Document | null>(null)

  const readyCount = documents.filter((d) => d.status === 'ready').length

  const handleConfirmDelete = () => {
    if (!pendingDelete) return
    deleteDocument(pendingDelete.id)
    toast.success(`Deleted "${pendingDelete.name}"`)
    setPendingDelete(null)
  }

  return (
    <ChatLayout>
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-5">
          {/* Header */}
         <section className="pt-2 lg:pt-0">
              <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-4 shadow-card sm:p-6">
                {/* Subtle light/dark radial gradient */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(15,119,114,0.1),transparent_45%)]" />
                
                {/* Low opacity subtle medicine.png background element */}
                <div className="absolute right-0 bottom-0 top-0 w-1/3 pointer-events-none select-none overflow-hidden hidden md:block">
                  <div className="absolute inset-0 bg-gradient-to-r from-surface to-transparent z-10 w-24" />
                  <img
                    src={medicineVerificationImage}
                    alt=""
                    className="absolute right-4 bottom-2 h-full max-h-[140px] w-auto object-contain opacity-30"
                  />
                </div>

                <div className="relative max-w-xl space-y-2 z-20">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Pharmaceutical Reference
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-2xl">
                    Pharmaceutical Label Documents
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-fg-secondary">
                    Upload and manage FDA-approved prescribing information for accurate, evidence-grounded AI responses.
                  </p>
                </div>
              </div>
            </section>

          {/* Upload Area */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
            <h2 className="text-sm font-bold text-primary mb-3">Upload Approved Drug Label (PDF)</h2>
            <DocumentUpload />
          </div>

          {/* Search & List */}
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-primary">
                  Repository Labels ({readyCount} Active)
                </h2>
              </div>
              <DocumentSearch />
            </div>

            <DocumentList onDelete={setPendingDelete} onView={setViewingDocument} />
          </div>
        </div>
      </div>








      <DeleteDocumentDialog
        document={pendingDelete}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
      />

      <DocumentViewerModal
        document={viewingDocument}
        open={!!viewingDocument}
        onClose={() => setViewingDocument(null)}
      />
    </ChatLayout>
  )
}