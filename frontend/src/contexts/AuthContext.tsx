/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { loginRequest, registerRequest, getMeRequest } from '../api/auth'
import type { UserProfile } from '../api/auth'
import { AUTH_LOGOUT_EVENT } from '../api/client'

interface AuthContextType {
  user: UserProfile | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
  updateUser: (fields: Partial<UserProfile>) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = 'labelproof_token'

function decodeJwtExp(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    const decoded = JSON.parse(atob(payload))
    return decoded?.exp ?? null
  } catch {
    return null
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [token, setToken] = useState<string | null>(() => {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (!stored) return null
    // Drop already-expired tokens on init
    const exp = decodeJwtExp(stored)
    if (exp && exp * 1000 <= Date.now()) {
      localStorage.removeItem(TOKEN_KEY)
      return null
    }
    return stored
  })
  const [loading, setSubmitting] = useState<boolean>(true)

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  // Auto-logout when the JWT expires (client-side timer)
  useEffect(() => {
    if (!token) return
    const exp = decodeJwtExp(token)
    if (!exp) return

    const msUntilExpiry = exp * 1000 - Date.now()
    if (msUntilExpiry <= 0) {
      // Defer to avoid synchronous setState in effect
      const t = setTimeout(() => logout(), 0)
      return () => clearTimeout(t)
    }

    const timer = setTimeout(() => {
      logout()
    }, msUntilExpiry)

    return () => clearTimeout(timer)
  }, [token, logout])

  // Auto-logout when any API call returns 401
  useEffect(() => {
    const handleLogout = () => logout()
    window.addEventListener(AUTH_LOGOUT_EVENT, handleLogout)
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, handleLogout)
  }, [logout])

  // Restore session on mount
  useEffect(() => {
    const initializeAuth = async () => {
      if (token) {
        try {
          const profile = await getMeRequest()
          setUser(profile)
        } catch (err) {
          console.error('Failed to restore authentication session:', err)
          logout()
        }
      }
      setSubmitting(false)
    }
    initializeAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = async (email: string, password: string) => {
    setSubmitting(true)
    try {
      const res = await loginRequest(email, password)
      localStorage.setItem(TOKEN_KEY, res.access_token)
      setToken(res.access_token)

      const profile = await getMeRequest()
      setUser(profile)
    } catch (err) {
      logout()
      throw err
    } finally {
      setSubmitting(false)
    }
  }

  const register = async (email: string, password: string) => {
    setSubmitting(true)
    try {
      await registerRequest(email, password)
    } finally {
      setSubmitting(false)
    }
  }

  const updateUser = useCallback((fields: Partial<UserProfile>) => {
    setUser((prev) => (prev ? { ...prev, ...fields } : null))
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
