import { useState } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function PasswordInput({ label, error, ...props }: PasswordInputProps) {
  const [show, setShow] = useState(false)
  const errorId = error && props.id ? `${props.id}-error` : undefined

  return (
    <div>
      <label
        className="mb-1.5 block text-sm font-medium text-fg"
        htmlFor={props.id}
      >
        {label}
      </label>
      <div className="relative">
        <Lock
          className="pointer-events-none absolute top-1/2 -translate-y-1/2 left-3 h-4 w-4 text-text-tertiary"
          aria-hidden="true"
        />
        <input
          {...props}
          type={show ? 'text' : 'password'}
          aria-invalid={!!error}
          aria-describedby={errorId}
          className={`clinical-input w-full py-3 pl-10 pr-10 text-sm placeholder:text-fg-muted ${
            error ? 'border-danger focus:border-danger focus:ring-danger/10' : ''
          }`}
        />

        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-fg-muted transition-colors hover:bg-surface-highlight hover:text-fg"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}








