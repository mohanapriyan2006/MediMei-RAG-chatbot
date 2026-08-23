import { useEffect, useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { X, Info } from 'lucide-react'

export function PreviewBanner() {
  const location = useLocation()
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    setClosed(false)
  }, [location.pathname])

  if (closed) return null

  return (
    <div className="fixed right-4 bottom-4 z-50 w-64 rounded-xl border border-warning/30 bg-warning/10 p-3 shadow-card">
      <div className="flex gap-2">
        <Info className="h-4 w-4 shrink-0 text-warning" />
        <div className="min-w-0 text-xs text-warning">
          <p className="font-bold">Preview only</p>
          <p className="mt-0.5 leading-snug">
            Data stays in your browser; answers are LLM-generated. See the <Link to="/demo" className="underline hover:text-amber-700">real demo</Link>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setClosed(true)}
          className="shrink-0 rounded-full p-0.5 text-warning hover:bg-warning/20"
          aria-label="Close preview notice"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}