import { Link } from 'react-router-dom'
import { Sparkles, ArrowRight, BookOpen } from 'lucide-react'

export function FinalCtaSection() {
  return (
    <section className="px-5 py-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-10 py-16 text-center text-white shadow-hover">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-teal/25 blur-3xl" aria-hidden />
          <div className="absolute -left-20 -bottom-20 h-72 w-72 rounded-full bg-accent/15 blur-2xl" aria-hidden />

          <div className="relative z-10 max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl leading-tight">
              Ready to verify drug information with clinical precision?
            </h2>
            <p className="text-sm leading-relaxed text-white/75">
              Launch the MediMei AI Assistant to start querying prescribing labels and inspecting page citations immediately.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                to="/chat"
                className="inline-flex items-center gap-2 rounded-pill bg-white px-8 py-3.5 text-sm font-bold text-primary shadow-hover hover:bg-surface-warm transition-all duration-200 active:scale-[0.97]"
              >
                <Sparkles className="h-4 w-4 text-accent" />
                <span>Launch Assistant</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/documents"
                className="inline-flex items-center gap-2 rounded-pill border border-white/25 bg-white/8 px-6 py-3.5 text-sm font-semibold text-white hover:bg-white/15 transition-all duration-200"
              >
                <BookOpen className="h-4 w-4" />
                <span>Browse Drug Library</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
