import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, User, ArrowLeft, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { AuthLayout } from '../components/auth/AuthLayout'
import { AuthDivider } from '../components/auth/AuthDivider'
import { AuthInput } from '../components/auth/AuthInput'
import { PasswordInput } from '../components/auth/PasswordInput'
import { PasswordStrength } from '../components/auth/PasswordStrength'
import { useAuth } from '../hooks/useAuth'
import {
  getErrorMessage,
  validateSignUp,
  validateSignUpField,
} from '../utils/authValidation'

interface FormErrors {
  name?: string
  email?: string
  password?: string
  confirmPassword?: string
}

export default function SignUpPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const validate = (): boolean => {
    const next = validateSignUp({ name, email, password, confirmPassword })
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleBlur = (field: 'name' | 'email' | 'password' | 'confirmPassword') => {
    const value = { name, email, password, confirmPassword }[field]
    const message = validateSignUpField(field, value, {
      password: field === 'confirmPassword' ? password : undefined,
    })
    setErrors((prev) => ({ ...prev, [field]: message ?? undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setFormError(null)
    setSubmitting(true)
    try {
      await register(email, password)
      toast.success('Account created successfully! Please sign in.')
      navigate('/signin')
    } catch (err) {
      setFormError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <div className="mx-auto w-full max-w-sm">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-fg-muted hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Home</span>
        </Link>

        <h1 className="text-2xl font-bold tracking-tight text-primary">Create an account</h1>
        <p className="mt-1 mb-8 text-xs sm:text-sm text-fg-secondary">
          Join MediMei to query official prescribing labels.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 " noValidate>
          <AuthInput
            id="signup-name"
            label="Full Name"
            type="text"
            placeholder="Dr. Jane Doe"
            icon={User}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (formError) setFormError(null)
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }))
            }}
            onBlur={() => handleBlur('name')}
            error={errors.name}
            autoComplete="name"
          />

          <AuthInput
            id="signup-email"
            label="Email Address"
            type="email"
            placeholder="physician@hospital.org"
            icon={Mail}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (formError) setFormError(null)
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }))
            }}
            onBlur={() => handleBlur('email')}
            error={errors.email}
            autoComplete="email"
          />

          <PasswordInput
            id="signup-password"
            label="Password"
            placeholder="Create a strong password (min 8 chars)"
            value={password}
            onChange={(e) => {
              const value = e.target.value
              setPassword(value)
              if (formError) setFormError(null)

              const passwordError = validateSignUpField('password', value)
              setErrors((prev) => ({ ...prev, password: passwordError ?? undefined }))

              if (confirmPassword) {
                const confirmError = validateSignUpField('confirmPassword', confirmPassword, {
                  password: value,
                })
                setErrors((prev) => ({ ...prev, confirmPassword: confirmError ?? undefined }))
              }
            }}
            onBlur={() => handleBlur('password')}
            error={errors.password}
            autoComplete="new-password"
          />

          <PasswordStrength password={password} />

          <PasswordInput
            id="signup-confirm"
            label="Confirm Password"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => {
              const value = e.target.value
              setConfirmPassword(value)
              if (formError) setFormError(null)
              const confirmError = validateSignUpField('confirmPassword', value, { password })
              setErrors((prev) => ({ ...prev, confirmPassword: confirmError ?? undefined }))
            }}
            onBlur={() => handleBlur('confirmPassword')}
            error={errors.confirmPassword}
            autoComplete="new-password"
          />

          {formError && (
            <div
              className="flex items-start gap-2 rounded-xl border border-danger/20 bg-danger/5 px-3.5 py-2.5 text-sm text-danger"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-pill bg-primary py-3 text-sm font-bold text-white shadow-card transition-all hover:bg-primary-hover active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? 'Creating account…' : 'Create MediMei Account'}
          </button>
        </form>

        <div className="my-6">
          <AuthDivider />
        </div>

        <p className="mt-6 text-center text-xs text-fg-secondary">
          Already have an account?{' '}
          <Link to="/signin" className="font-bold text-primary transition-colors hover:text-accent underline">
            Sign in
          </Link>
        </p>
      </div>



    </AuthLayout>
  )
}




