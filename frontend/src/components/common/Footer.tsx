import { ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="w-full border-t border-border bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-6 sm:flex-row lg:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-white">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold text-primary">MediMei</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-accent">Clinical AI</span>
          </div>
        </div>

        <p className="text-center text-xs text-fg-secondary">
          Built by Mohanapriyan M, Mithilesh ES, Anand VB, Gokulkrishnan M, Harees Ahamed K, Kanishkar P
        </p>

        <p className="text-xs text-fg-muted">
          <Link to="/about" className="hover:text-primary">Cognizant NPN Hackathon 2026</Link> · Use Case 7
        </p>
      </div>
    </footer>
  )
}

export default Footer