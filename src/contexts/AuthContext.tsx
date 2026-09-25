import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import type { User } from '@/types/rh'

interface AuthContextType {
  user: User | null
  role: 'admin' | 'rh' | 'funcionario' | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<User>
  signOut: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const syncUserFromAuthStore = () => {
    if (pb.authStore.isValid && pb.authStore.record) {
      const rec = pb.authStore.record
      const u: User = {
        id: rec.id,
        email: rec.email || '',
        name: rec.name || rec.nome || '',
        nome: rec.nome || rec.name || '',
        role: (rec.role as any) || 'funcionario',
        ativo: rec.ativo !== false,
        avatar: rec.avatar ? pb.files.getURL(rec, rec.avatar) : undefined,
        created: rec.created,
        updated: rec.updated,
      }
      setUser(u)
    } else {
      setUser(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    syncUserFromAuthStore()
    const unsubscribe = pb.authStore.onChange(() => {
      syncUserFromAuthStore()
    })
    return () => {
      unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string): Promise<User> => {
    const authData = await pb.collection('users').authWithPassword(email.trim(), password)
    const rec = authData.record
    const u: User = {
      id: rec.id,
      email: rec.email || '',
      name: rec.name || rec.nome || '',
      nome: rec.nome || rec.name || '',
      role: (rec.role as any) || 'funcionario',
      ativo: rec.ativo !== false,
      avatar: rec.avatar ? pb.files.getURL(rec, rec.avatar) : undefined,
      created: rec.created,
      updated: rec.updated,
    }
    setUser(u)
    return u
  }

  const signOut = () => {
    pb.authStore.clear()
    setUser(null)
  }

  const refreshUser = async () => {
    if (pb.authStore.isValid && pb.authStore.record?.id) {
      try {
        const fresh = await pb.collection('users').getOne<User>(pb.authStore.record.id)
        setUser(fresh)
      } catch {
        syncUserFromAuthStore()
      }
    }
  }

  const role = user?.role || null

  return (
    <AuthContext.Provider value={{ user, role, loading, signIn, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
