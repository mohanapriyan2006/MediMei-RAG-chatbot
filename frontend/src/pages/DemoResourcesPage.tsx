import { Navbar } from '../components/common/Navbar'
import { Footer } from '../components/common/Footer'
import { Play, FileText, Image, Presentation } from 'lucide-react'
import demoVideo from '../assets/demo/demo-video.mp4'
import demoThumbnail from '../assets/demo/demo-video-thumbnail.jpeg'
import pptPdf from '../assets/demo/ppt.pdf'
import erDiagram from '../assets/demo/ER-diagram.png'

export default function DemoResourcesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-fg">
      <Navbar />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <div className="space-y-10">
          <section>
            <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
              Real demo resources
            </h1>
            <p className="mt-4 text-base leading-relaxed text-fg-secondary">
              The live preview on Vercel is a client-side simulation. For the real backend, RAG database, vector search,
              OCR, and full clinical validation, refer to the deliverables below.
            </p>
          </section>

          <section className="rounded-3xl border border-border bg-surface p-6 shadow-card">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-fg-muted">
              <Play className="h-4 w-4 text-accent" />
              <span>Demo video</span>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-black">
              <video
                src={demoVideo}
                poster={demoThumbnail}
                controls
                preload="metadata"
                className="w-full"
                aria-label="MediMei demo video"
              />
            </div>
            <p className="mt-3 text-sm text-fg-secondary">
              Walkthrough of the full MediMei flow from upload to grounded answers and comparison.
            </p>
          </section>

          <section className="rounded-3xl border border-border bg-surface p-6 shadow-card">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-fg-muted">
              <Presentation className="h-4 w-4 text-accent" />
              <span>Presentation PPT</span>
            </div>
            <p className="mt-3 text-sm text-fg-secondary">
              Exported as PDF for easy viewing. Download or open it below.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={pptPdf}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-pill bg-primary px-4 py-2 text-sm font-bold text-white shadow-subtle hover:bg-primary-hover"
              >
                <FileText className="h-4 w-4" />
                Open PPT (PDF)
              </a>
              <a
                href={pptPdf}
                download
                className="inline-flex items-center gap-2 rounded-pill border border-border bg-surface px-4 py-2 text-sm font-bold text-fg shadow-subtle hover:bg-surface-highlight"
              >
                Download
              </a>
            </div>
            <div className="mt-4 h-96 overflow-hidden rounded-2xl border border-border bg-white">
              <iframe
                src={pptPdf}
                title="MediMei PPT"
                className="h-full w-full"
              />
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-surface p-6 shadow-card">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-fg-muted">
              <Image className="h-4 w-4 text-accent" />
              <span>Architecture diagram</span>
            </div>
            <p className="mt-3 text-sm text-fg-secondary">
              Entity-relationship and high-level system overview.
            </p>
            <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-white">
              <img src={erDiagram} alt="MediMei ER and architecture diagram" className="w-full object-contain" />
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary">Preview limitations</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-fg-secondary">
              <li>All data is stored in the browser and is lost if the cache is cleared.</li>
              <li>Answers are generated directly by the Groq LLM using keyword search, not a full RAG pipeline.</li>
              <li>Citations and comparisons are approximations for demonstration purposes.</li>
              <li>PDF extraction is done in the browser and may not match the backend OCR quality.</li>
            </ul>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}