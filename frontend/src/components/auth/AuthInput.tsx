import type { LucideIcon } from 'lucide-react'

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  icon: LucideIcon
  error?: string
}

export function AuthInput({ label, icon: Icon, error, className, ...props }: AuthInputProps) {
  const errorId = error && props.id ? `${props.id}-error` : undefined
  return (
    <div className={className}>
      <label
        className="mb-1.5 block text-sm font-medium text-fg"
        htmlFor={props.id}
      >
        {label}
      </label>
      <div className="relative flex items-center">
        <Icon
          className="pointer-events-none absolute left-3 h-4 w-4 text-text-tertiary"
          aria-hidden="true"
        />
        <input
          {...props}
          aria-invalid={!!error}
          aria-describedby={errorId}
          className={`clinical-input w-full py-3 pl-10 pr-3 text-sm placeholder:text-fg-muted ${
            error ? 'border-danger focus:border-danger focus:ring-danger/10' : ''
          } ${className ?? ''}`}
        />
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
