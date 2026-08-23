import { Check, X } from 'lucide-react'
import { getPasswordStrength } from '../../utils/authValidation'

interface PasswordStrengthProps {
  password: string
}

const RULES = [
  { key: 'minLength', label: 'At least 8 characters' },
  { key: 'hasLower', label: 'One lowercase letter' },
  { key: 'hasUpper', label: 'One uppercase letter' },
  { key: 'hasNumber', label: 'One number' },
  { key: 'hasSpecial', label: 'One special character' },
] as const

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const strength = getPasswordStrength(password)

  const score = strength.score
  const percentage = (score / 5) * 100

  let colorClass = 'bg-danger'
  if (score >= 4) colorClass = 'bg-success'
  else if (score >= 3) colorClass = 'bg-accent'
  else if (score >= 2) colorClass = 'bg-warning'

  return (
    <div className="space-y-2" aria-live="polite" aria-atomic="true">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-highlight">
        <div
          className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {RULES.map((rule) => {
          const met = strength[rule.key]
          return (
            <li
              key={rule.key}
              className={`flex items-center gap-1.5 text-xs ${met ? 'text-success' : 'text-fg-muted'}`}
            >
              {met ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{rule.label}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default PasswordStrength
