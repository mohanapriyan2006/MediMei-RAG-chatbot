import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, ArrowLeft, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { AuthLayout } from '../components/auth/AuthLayout'
import { AuthDivider } from '../components/auth/AuthDivider'
import { AuthInput } from '../components/auth/AuthInput'
import { PasswordInput } from '../components/auth/PasswordInput'
import { useAuth } from '../hooks/useAuth'
import { validateSignIn, validateSignInField, getErrorMessage } from '../utils/authValidation'

interface FormErrors {
  email?: string
  password?: string
}
export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const validate = (): boolean => {
    const next = validateSignIn({ email, password })
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleBlur = (field: 'email' | 'password') => {
    const message = validateSignInField(field, field === 'email' ? email : password)
    setErrors((prev) => ({ ...prev, [field]: message ?? undefined }))
  }
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setFormError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      toast.success('Signed in successfully')
      navigate('/chat')
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

        <h1 className="text-2xl font-bold tracking-tight text-primary">Welcome back</h1>
        <p className="mt-1 mb-8 text-xs sm:text-sm text-fg-secondary">
          Sign in to access the MediMei clinical AI assistant.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <AuthInput
            id="signin-email"
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
            id="signin-password"
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (formError) setFormError(null)
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }))
            }}
            onBlur={() => handleBlur('password')}
            error={errors.password}
            autoComplete="current-password"
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
            {submitting ? 'Signing in…' : 'Sign in to MediMei'}
          </button>
        </form>

        <div className="my-6">
          <AuthDivider />
        </div>

        <p className="mt-6 text-center text-xs text-fg-secondary">
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="font-bold text-primary transition-colors hover:text-accent underline">
            Create an account
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
