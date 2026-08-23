import { CornerDownRight } from 'lucide-react'

interface FollowUpListProps {
  questions: string[]
  onSelect: (question: string) => void
}


export function FollowUpList({ questions, onSelect }: FollowUpListProps) {
  return (
    <div className="mt-4 flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-fg-muted">Follow-ups</span>
      {questions.map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => onSelect(q)}
          className="group flex w-full items-center gap-2 rounded-2xl border border-border px-3 py-2.5 text-left text-sm text-fg transition-colors hover:border-primary/20 hover:bg-surface-highlight"
        >
          <CornerDownRight
            className="h-3.5 w-3.5 shrink-0 text-fg-subtle transition-colors group-hover:text-primary"
            aria-hidden="true"
          />
          <span>{q}</span>
        </button>
      ))}
    </div>
  )
}








