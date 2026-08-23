import { Link } from 'react-router-dom'
import { ShieldCheck, FileSearch, CheckCircle2, ChevronRight } from 'lucide-react'
import { Card } from '../common/Card'

export function TrustSection() {
  return (
    <section className="px-5 py-14 lg:px-8 border-y border-border bg-surface-warm/30">
      <div className="mx-auto max-w-7xl">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent mb-2">
            Evidence-First Architecture
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">
            Built for Clinical Certainty
          </h2>
          <p className="mt-3 text-sm text-fg-secondary leading-relaxed">
            Not guesswork. Every answer is grounded in the official prescribing label, with full provenance tracking.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <Card hover variant="default" className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/8 text-primary border border-primary/10">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-fg">Verifiable Citations</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-secondary">
                Every AI-generated answer provides exact source metadata: document title, page number, section header, and original excerpt.
              </p>
            </div>
            <Link to="/chat" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-accent transition-colors">
              <span>See it in action</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Card>

          <Card hover variant="default" className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal/8 text-teal border border-teal/10">
              <FileSearch className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-fg">Exact Page Alignment</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-secondary">
                Dense vector chunking preserves document structure, enabling clinicians to cross-reference statements with the exact physical page.
              </p>
            </div>
            <Link to="/documents" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-accent transition-colors">
              <span>Browse labels</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Card>

          <Card hover variant="default" className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/8 text-accent border border-accent/10">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-fg">Safe Abstention</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-secondary">
                When evidence is insufficient, the system safely abstains rather than making unverified medical claims.
              </p>
            </div>
            <Link to="/#how-it-works" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-accent transition-colors">
              <span>Learn how</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Card>
        </div>
      </div>
    </section>
  )
}
