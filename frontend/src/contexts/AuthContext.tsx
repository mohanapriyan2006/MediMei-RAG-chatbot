/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { UserProfile } from '../api/auth'
import {
  getToken as getStoredToken,
  setToken as setStoredToken,
  removeToken,
  getUser as getStoredUser,
  setUser as setStoredUser,
  removeUser,
  login as storeLogin,
  register as storeRegister,
} from '../services/authStore'

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
  const [user, setUser] = useState<UserProfile | null>(getStoredUser)
  const [token, setToken] = useState<string | null>(getStoredToken)
  const [loading, setLoading] = useState<boolean>(true)

  const logout = useCallback(() => {
    removeToken()
    removeUser()
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    const stored = getStoredToken()
    if (stored) {
      const exp = decodeJwtExp(stored)
      if (exp && exp * 1000 <= Date.now()) {
        logout()
      } else {
        setToken(stored)
        setUser(getStoredUser())
      }
    }
    setLoading(false)
  }, [logout])

  // Auto-logout when the fake token expires
  useEffect(() => {
    if (!token) return
    const exp = decodeJwtExp(token)
    if (!exp) return

    const msUntilExpiry = exp * 1000 - Date.now()
    if (msUntilExpiry <= 0) {
      const t = setTimeout(() => logout(), 0)
      return () => clearTimeout(t)
    }

    const timer = setTimeout(() => logout(), msUntilExpiry)
    return () => clearTimeout(timer)
  }, [token, logout])

  const login = async (email: string, password: string) => {
    setLoading(true)
    try {
      const { token: newToken, user: newUser } = storeLogin(email, password)
      setStoredToken(newToken)
      setStoredUser(newUser)
      setToken(newToken)
      setUser(newUser)
    } catch (err) {
      logout()
      throw err
    } finally {
      setLoading(false)
    }
  }

  const register = async (email: string, password: string) => {
    setLoading(true)
    try {
      const { token: newToken, user: newUser } = storeRegister(email, password)
      setStoredToken(newToken)
      setStoredUser(newUser)
      setToken(newToken)
      setUser(newUser)
    } finally {
      setLoading(false)
    }
  }

  const updateUser = useCallback((fields: Partial<UserProfile>) => {
    setUser((prev) => {
      if (!prev) return null
      const next = { ...prev, ...fields }
      setStoredUser(next)
      return next
    })
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