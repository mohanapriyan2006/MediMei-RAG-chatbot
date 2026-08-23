import { Navbar } from '../components/common/Navbar'
import { Footer } from '../components/common/Footer'

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-fg">
      <Navbar />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <section>
            <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
              About MediMei
            </h1>
            <p className="mt-4 text-base leading-relaxed text-fg-secondary">
              MediMei is an AI-powered pharmaceutical reference assistant. It lets clinicians and researchers upload
              approved drug labels, ask evidence-grounded questions, and compare medications side-by-side. The system
              uses retrieval-augmented generation (RAG) to keep answers anchored to real prescribing information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary">Core features</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-fg-secondary">
              <li>Upload and manage FDA-approved drug-label PDFs and DOCX files.</li>
              <li>Ask natural-language questions and receive grounded answers with citations.</li>
              <li>Compare two drugs across clinical attributes such as indications, warnings, and adverse reactions.</li>
              <li>Save conversation history and comparisons locally.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary">Tech stack</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
                <span className="text-xs font-bold uppercase tracking-wider text-fg-muted">Frontend</span>
                <p className="mt-1 text-sm font-semibold text-fg">React, Vite, TypeScript, Tailwind CSS</p>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
                <span className="text-xs font-bold uppercase tracking-wider text-fg-muted">LLM</span>
                <p className="mt-1 text-sm font-semibold text-fg">Groq API (qwen/qwen3.6-27b)</p>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
                <span className="text-xs font-bold uppercase tracking-wider text-fg-muted">Storage</span>
                <p className="mt-1 text-sm font-semibold text-fg">Browser localStorage (preview only)</p>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
                <span className="text-xs font-bold uppercase tracking-wider text-fg-muted">Deployment</span>
                <p className="mt-1 text-sm font-semibold text-fg">Vercel</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary">Developer details</h2>
            <p className="mt-4 text-base leading-relaxed text-fg-secondary">
              MediMei was built as a final-year / portfolio project focused on trustworthy clinical AI.
            </p>
            <div className="mt-4 rounded-2xl border border-border bg-surface p-5 shadow-card">
              <p className="text-sm font-semibold text-fg">Developer</p>
              <p className="text-sm text-fg-secondary">Mohanapriyan (and team)</p>
              <p className="mt-3 text-sm font-semibold text-fg">Repository</p>
              <a
                href="https://github.com/mohanapriyan2006/MediMei-RAG-chatbot"
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary underline hover:text-accent"
              >
                github.com/mohanapriyan2006/MediMei-RAG-chatbot
              </a>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}