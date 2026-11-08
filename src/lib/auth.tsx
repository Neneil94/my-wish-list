import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { usernameToEmail } from './rules'
import { AppError } from './errors'
import { queryClient } from './queryClient'

export interface AuthState {
  ready: boolean
  session: Session | null
  userId: string | null
  signIn: (username: string, password: string) => Promise<void>
  signOut: (scope?: 'local' | 'global') => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (!s) queryClient.clear()
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthState>(() => ({
    ready,
    session,
    userId: session?.user.id ?? null,
    async signIn(username, password) {
      const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password })
      if (error) {
        if (error.status === 429) throw new AppError('too_many_attempts')
        throw new AppError('invalid_credentials')
      }
    },
    async signOut(scope = 'local') {
      await supabase.auth.signOut({ scope })
      queryClient.clear()
    },
  }), [ready, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth außerhalb von AuthProvider')
  return ctx
}
