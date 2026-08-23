import { CheckCircle2 } from 'lucide-react'

export function AuthBrandPanel() {
  return (
    <div className="relative hidden h-full w-1/2 overflow-hidden bg-primary text-white lg:flex flex-col justify-between p-12 lg:p-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(15,119,114,0.28),transparent_26%)]" />
      <div className="absolute inset-y-0 right-0 w-[65%] bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />

      {/* Header */}
      <div className="relative z-10 flex items-center gap-2.5">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-white shadow-subtle transition-all duration-200 group-hover:shadow-card">
            <img src="/logo.png" alt="MediMei" className="h-16 w-16 object-contain" />
          </div>
        <div>
          <span className="text-lg font-bold tracking-tight">MediMei</span>
          <span className="block text-[10px] uppercase tracking-wider text-surface-warm/80">Clinical AI</span>
        </div>
      </div>

      {/* Center Value Prop */}
      <div className="relative z-10 max-w-md space-y-6">
        <h2 className="max-w-sm text-3xl font-bold tracking-tight text-white sm:text-4xl leading-tight">
          Evidence-First Drug Information, Grounded in Official Labels.
        </h2>
        <p className="text-sm leading-relaxed text-white/80">
          Access verified pharmaceutical prescribing guidelines, dosage regimens, warnings, and adverse reactions with exact page-level citations.
        </p>

        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
          {[
            'FDA Prescribing Information Grounding',
            'Zero-Hallucination Safe Abstention Rules',
            'Verifiable Page & Section Citations',
          ].map((item) => (
            <div key={item} className="flex items-center gap-3">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/20 text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-semibold text-white/90">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 text-xs text-white/60">
        © {new Date().getFullYear()} MediMei. Cognizant NPN Healthcare AI Initiative.
      </div>

    </div>
  )
}

export default AuthBrandPanel
