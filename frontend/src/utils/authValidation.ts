export type AuthField = 'name' | 'email' | 'password' | 'confirmPassword'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface PasswordStrength {
  minLength: boolean
  hasLower: boolean
  hasUpper: boolean
  hasNumber: boolean
  hasSpecial: boolean
  score: number
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email)
}

export function getPasswordStrength(password: string): PasswordStrength {
  const checks = {
    minLength: password.length >= 8,
    hasLower: /[a-z]/.test(password),
    hasUpper: /[A-Z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  }

  return {
    ...checks,
    score: Object.values(checks).filter(Boolean).length,
  }
}

export function validateSignInField(
  field: 'email' | 'password',
  value: string,
): string | undefined {
  switch (field) {
    case 'email':
      if (!value.trim()) return 'Email is required'
      if (!isValidEmail(value)) return 'Please enter a valid email address'
      return
    case 'password':
      if (!value) return 'Password is required'
      if (value.length < 6) return 'Password must be at least 6 characters'
      return
  }
}

export function validateSignIn(values: { email: string; password: string }): Record<string, string> {
  const errors: Record<string, string> = {}
  const emailError = validateSignInField('email', values.email)
  const passwordError = validateSignInField('password', values.password)
  if (emailError) errors.email = emailError
  if (passwordError) errors.password = passwordError
  return errors
}

export function validateSignUpField(
  field: AuthField,
  value: string,
  options?: { password?: string },
): string | undefined {
  switch (field) {
    case 'name':
      if (!value.trim()) return 'Name is required'
      if (value.trim().length < 2) return 'Name must be at least 2 characters'
      return
    case 'email':
      if (!value.trim()) return 'Email is required'
      if (!isValidEmail(value)) return 'Please enter a valid email address'
      return
    case 'password': {
      if (!value) return 'Password is required'
      if (value.length < 8) return 'Password must be at least 8 characters'
      const strength = getPasswordStrength(value)
      if (!strength.hasLower || !strength.hasUpper || !strength.hasNumber) {
        return 'Password must contain at least one uppercase, one lowercase, and one number'
      }
      return
    }
    case 'confirmPassword':
      if (!value) return 'Please confirm your password'
      if (options?.password !== undefined && value !== options.password) return 'Passwords do not match'
      return
  }
}

export function validateSignUp(values: {
  name: string
  email: string
  password: string
  confirmPassword: string
}): Record<string, string> {
  const errors: Record<string, string> = {}
  const nameError = validateSignUpField('name', values.name)
  const emailError = validateSignUpField('email', values.email)
  const passwordError = validateSignUpField('password', values.password)
  const confirmError = validateSignUpField('confirmPassword', values.confirmPassword, {
    password: values.password,
  })

  if (nameError) errors.name = nameError
  if (emailError) errors.email = emailError
  if (passwordError) errors.password = passwordError
  if (confirmError) errors.confirmPassword = confirmError
  return errors
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'An unexpected error occurred. Please try again.'
}
