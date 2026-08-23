import { Link } from 'react-router-dom'
import { ShieldCheck, ArrowRight, Sparkles, BookOpen } from 'lucide-react'
import { samplePrompts } from './homeData'

export function HeroSection() {
  return (
    <section className="relative px-5 pt-8 pb-16 lg:px-8 lg:pt-12 lg:pb-20">
      <div className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-3xl bg-primary shadow-hover">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-teal/20 blur-3xl" aria-hidden />
          <div className="absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-accent/15 blur-2xl" aria-hidden />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 min-h-[480px]">
            <div className="flex flex-col justify-center px-8 py-14 lg:px-14 lg:py-16">
              <div className="inline-flex items-center gap-2 rounded-pill bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-surface-warm backdrop-blur-sm border border-white/15 w-fit">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
                <span>FDA-Approved Label Grounding · Zero Hallucination</span>
              </div>

              <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl xl:text-[3.5rem] leading-[1.1]">
                Evidence-based drug information,{' '}
                <em className="font-serif font-normal italic text-surface-warm not-italic">
                  simplified.
                </em>
              </h1>

              <p className="mt-5 text-base leading-relaxed text-white/75 max-w-lg">
                Ask precise questions about pharmaceutical prescribing documentation and receive clear, grounded answers with verifiable page-level citations.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/chat"
                  className="inline-flex items-center gap-2.5 rounded-pill bg-white px-7 py-3.5 text-sm font-bold text-primary shadow-hover transition-all duration-200 hover:bg-surface-warm active:scale-[0.97]"
                >
                  <Sparkles className="h-4 w-4 text-accent" />
                  <span>Ask the AI</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  to="/documents"
                  className="inline-flex items-center gap-2 rounded-pill border border-white/25 bg-white/8 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/15 hover:border-white/40"
                >
                  <BookOpen className="h-4 w-4" />
                  <span>Explore Drug Library</span>
                </Link>
              </div>

              <div className="mt-9 border-t border-white/12 pt-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/50 mb-3">
                  Try asking:
                </p>
                <div className="flex flex-wrap gap-2">
                  {samplePrompts.map((prompt) => (
                    <Link
                      key={prompt}
                      to={`/chat?q=${encodeURIComponent(prompt)}`}
                      className="rounded-pill border border-white/18 bg-white/8 px-3 py-1.5 text-xs text-white/80 transition-all duration-150 hover:bg-white/18 hover:text-white hover:border-white/35"
                    >
                      {prompt}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="relative hidden lg:block">
              <img
                src="/hero-medical.jpg"
                alt="Medical research team reviewing pharmaceutical documentation"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/60 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/40 via-transparent to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
