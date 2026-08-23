import { apiFetch } from './client'

export interface UserProfile {
  user_id: string
  email: string
  role: string
  created_at: string
  name?: string
  full_name?: string
  username?: string
  display_name?: string
  memory_enabled?: boolean
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export async function loginRequest(email: string, password: string): Promise<TokenResponse> {
  return apiFetch<TokenResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function registerRequest(email: string, password: string): Promise<UserProfile> {
  return apiFetch<UserProfile>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function getMeRequest(): Promise<UserProfile> {
  return apiFetch<UserProfile>('/api/v1/auth/me')
}
