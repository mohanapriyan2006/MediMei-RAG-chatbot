import type { UserProfile } from '../api/auth'

const TOKEN_KEY = 'labelproof_token'
const USER_KEY = 'medimei_user_v1'
const USERS_KEY = 'medimei_users_v1'

export interface StoredUser {
  user_id: string
  email: string
  full_name?: string
  password: string
  created_at: string
}

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

function getUsers(): Record<string, StoredUser> {
  const raw = localStorage.getItem(USERS_KEY)
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, StoredUser>
  } catch {
    return {}
  }
}

function saveUser(stored: StoredUser): void {
  const users = getUsers()
  users[stored.email.toLowerCase()] = stored
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function createFakeToken(userId: string): string {
  const payload = JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 31536000 })
  return `fake.${btoa(payload)}.signature`
}

function toUserProfile(stored: StoredUser): UserProfile {
  const displayName = stored.full_name || stored.email.split('@')[0]
  return {
    user_id: stored.user_id,
    email: stored.email,
    role: 'user',
    created_at: stored.created_at,
    name: displayName,
    full_name: stored.full_name,
    username: stored.email,
    display_name: displayName,
    memory_enabled: false,
  }
}

export function login(email: string, password: string): { token: string; user: UserProfile } {
  const users = getUsers()
  const stored = users[email.toLowerCase()]
  if (!stored) {
    throw new Error('No account found with this email. Please sign up first.')
  }
  if (stored.password !== password) {
    throw new Error('Invalid password.')
  }
  const user = toUserProfile(stored)
  const token = createFakeToken(user.user_id)
  setToken(token)
  setUser(user)
  return { token, user }
}

export function register(email: string, password: string, fullName?: string): { token: string; user: UserProfile } {
  const normalizedEmail = email.toLowerCase()
  const users = getUsers()
  if (users[normalizedEmail]) {
    throw new Error('An account with this email already exists. Please sign in.')
  }
  const stored: StoredUser = {
    user_id: crypto.randomUUID(),
    email: normalizedEmail,
    full_name: fullName?.trim(),
    password,
    created_at: new Date().toISOString(),
  }
  saveUser(stored)
  return login(normalizedEmail, password)
}

export function logout(): void {
  removeToken()
  removeUser()
}