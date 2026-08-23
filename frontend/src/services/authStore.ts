import type { UserProfile } from '../api/auth'

const TOKEN_KEY = 'labelproof_token'
const USER_KEY = 'medimei_user_v1'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function getUser(): UserProfile | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as UserProfile
  } catch {
    return null
  }
}

export function setUser(user: UserProfile): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function removeUser(): void {
  localStorage.removeItem(USER_KEY)
}

function createFakeToken(userId: string): string {
  const payload = JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 31536000 })
  return `fake.${btoa(payload)}.signature`
}

export function createUser(email: string, fullName?: string): UserProfile {
  const displayName = fullName?.trim() || email.split('@')[0]
  return {
    user_id: crypto.randomUUID(),
    email,
    role: 'user',
    created_at: new Date().toISOString(),
    name: displayName,
    full_name: fullName?.trim(),
    username: email,
    display_name: displayName,
    memory_enabled: false,
  }
}

export function login(email: string, _password: string, fullName?: string): { token: string; user: UserProfile } {
  const user = createUser(email, fullName)
  const token = createFakeToken(user.user_id)
  setToken(token)
  setUser(user)
  return { token, user }
}

export function register(email: string, _password: string, fullName?: string): { token: string; user: UserProfile } {
  return login(email, _password, fullName)
}

export function logout(): void {
  removeToken()
  removeUser()
}