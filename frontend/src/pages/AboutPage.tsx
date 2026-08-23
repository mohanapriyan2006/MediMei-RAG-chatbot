import { Navbar } from '../components/common/Navbar'
import { Footer } from '../components/common/Footer'
import {
  ShieldCheck,
  Search,
  MessageCircle,
  FileText,
  Scale,
  AlertTriangle,
  Zap,
  Bot,
  Layers,
} from 'lucide-react'

const capabilities = [
  { icon: Search, label: 'Evidence-First RAG', description: 'Retrieves relevant document content before generating an answer.' },
  { icon: FileText, label: 'Page-Level Citations', description: 'Every grounded response can be traced back to its source document and PDF page.' },
  { icon: MessageCircle, label: 'Context-Aware AI', description: 'Maintains conversational context to handle follow-up questions naturally.' },
  { icon: Bot, label: 'OCR Support', description: 'Processes scanned and image-based medical documents using OCR.' },
  { icon: Scale, label: 'Drug Comparison', description: 'Enables users to compare information across multiple drug documents.' },
  { icon: AlertTriangle, label: 'Safe Abstention', description: 'When sufficient evidence is not available, MediMei avoids unsupported answers.' },
  { icon: Zap, label: 'Fast Retrieval', description: 'Reduces the time required to manually search lengthy medical documentation.' },
]

const stack = [
  { title: 'Frontend', items: ['React', 'TypeScript', 'PDF.js'] },
  { title: 'Backend', items: ['Python', 'FastAPI'] },
  { title: 'RAG & AI', items: ['BGE-M3 embeddings', 'Qdrant vector database', 'Qwen 3.5 4B', 'Retrieval + context generation pipeline'] },
  { title: 'Document Processing', items: ['PyMuPDF', 'PaddleOCR', 'PDF text and table extraction'] },
  { title: 'Data & Storage', items: ['MySQL', 'Document metadata and vector storage'] },
]

const team = [
  { name: 'Mohanapriyan M', role: 'Full Stack Developer | AI & RAG', links: { portfolio: 'https://mohanapriyan.dev', website: "https://mohanapriyan.netlify.app/", linkedin: 'https://linkedin.com/in/mohanapriyan-m2006' } },
  { name: 'Mithilesh ES', role: 'Developer | AI & Application Engineering' },
  { name: 'Anand VB', role: 'Developer | Application Engineering' },
  { name: 'Gokulkrishnan M', role: 'Developer | AI & Backend Engineering' },
  { name: 'Harees Ahamed K', role: 'Developer | Application Engineering' },
  { name: 'Kanishkar P', role: 'Developer | AI & Full-Stack Engineering' },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-fg">
      <Navbar />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <div className="space-y-14">
          {/* Hero intro */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent">
              <ShieldCheck className="h-4 w-4" />
              <span>About MediMei AI</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
              Evidence-First AI for Trusted Drug Information
            </h1>
            <p className="text-lg leading-relaxed text-fg-secondary">
              <strong>MediMei AI</strong> is a Retrieval-Augmented Generation (RAG) based drug information assistant
              designed to help users quickly find accurate, evidence-backed information from medical documents.
            </p>
            <p className="leading-relaxed text-fg-secondary">
              Instead of relying on general model knowledge, MediMei retrieves relevant information from the uploaded
              documents and generates answers grounded in that evidence, with document and page-level citations for
              verification.
            </p>
            <blockquote className="border-l-4 border-primary/30 pl-4 text-lg font-semibold text-primary italic">
              We do not guess. We show the proof.
            </blockquote>
            <p className="text-sm text-fg-muted">
              The project was developed for <strong>Cognizant NPN Hackathon 2026</strong> — Use Case 7: Q&amp;A Chatbot for Documentation.
            </p>
          </section>

          {/* Why MediMei */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-primary">Why MediMei?</h2>
            <p className="leading-relaxed text-fg-secondary">
              Medical documents such as drug labels, prescribing information, research papers, and regulatory documents
              can be lengthy and difficult to navigate. MediMei simplifies this by allowing users to:
            </p>
            <ul className="list-disc space-y-2 pl-5 text-fg-secondary">
              <li>Upload medical documents</li>
              <li>Ask questions in natural language</li>
              <li>Retrieve relevant evidence</li>
              <li>Generate context-aware answers</li>
              <li>View exact source and page citations</li>
              <li>Open the original source for verification</li>
              <li>Safely indicate when information is unavailable</li>
            </ul>
          </section>

          {/* Core capabilities */}
          <section className="space-y-6">
            <h2 className="text-2xl font-bold text-primary">Core Capabilities</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {capabilities.map((c) => {
                const Icon = c.icon
                return (
                  <div
                    key={c.label}
                    className="flex gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-fg">{c.label}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-fg-secondary">{c.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Technology */}
          <section className="space-y-6">
            <h2 className="text-2xl font-bold text-primary">Technology Behind MediMei</h2>
            <p className="leading-relaxed text-fg-secondary">
              The architecture follows a pipeline of document ingestion, extraction/OCR, chunking, embeddings, vector
              retrieval, context building, AI generation, and citation mapping.
            </p>
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-4 text-fg-secondary shadow-card">
              <Layers className="h-5 w-5 text-accent" />
              <p className="text-sm">
                Document Ingestion <span className="mx-1 text-fg-muted">-&gt;</span> Extraction/OCR <span className="mx-1 text-fg-muted">-&gt;</span> Chunking <span className="mx-1 text-fg-muted">-&gt;</span> Embeddings <span className="mx-1 text-fg-muted">-&gt;</span> Vector Retrieval <span className="mx-1 text-fg-muted">-&gt;</span> Context Building <span className="mx-1 text-fg-muted">-&gt;</span> AI Generation <span className="mx-1 text-fg-muted">-&gt;</span> Citation Mapping
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {stack.map((s) => (
                <div key={s.title} className="rounded-2xl border border-border bg-surface p-5 shadow-card">
                  <h3 className="text-sm font-bold text-primary">{s.title}</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-fg-secondary">
                    {s.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Developer team */}
          <section className="space-y-6">
            <h2 className="text-2xl font-bold text-primary">Meet the Developer Team</h2>
            <p className="leading-relaxed text-fg-secondary">
              MediMei AI is developed by a six-member student engineering team focused on AI, full-stack development,
              RAG systems, and building practical solutions for healthcare information access.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {team.map((member) => (
                <div key={member.name} className="rounded-2xl border border-border bg-surface p-4 shadow-card">
                  <h3 className="text-sm font-bold text-fg">{member.name}</h3>
                  <p className="text-xs text-fg-secondary">{member.role}</p>
                  {member.links && (
                    <div className="mt-2 flex flex-wrap gap-3 text-xs">
                      {member.links.portfolio && (
                        <a href={member.links.portfolio} target="_blank" rel="noreferrer" className="text-primary underline hover:text-accent">
                          Portfolio
                        </a>
                      )}
                      {member.links.linkedin && (
                        <a href={member.links.linkedin} target="_blank" rel="noreferrer" className="text-primary underline hover:text-accent">
                          LinkedIn
                        </a>
                      )}
                      {member.links.website && (
                        <a href={member.links.website} target="_blank" rel="noreferrer" className="text-primary underline hover:text-accent">
                          Website
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Mission */}
          <section className="rounded-3xl border border-border bg-surface p-8 text-center shadow-card">
            <h2 className="text-xl font-bold text-primary">Our Mission</h2>
            <p className="mt-3 text-base leading-relaxed text-fg-secondary">
              Make medical information easier to find, understand, and verify.
            </p>
            <p className="mt-4 text-sm font-semibold text-fg">
              Answer with evidence. Cite the source. Never guess when the evidence is not there.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}