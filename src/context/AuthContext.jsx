import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getOrCreateKeyPair, exportPublicKey } from '../lib/crypto'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // When a user logs in, ensure their public key is in the DB so others can
  // derive the shared E2E encryption key for conversations with them.
  useEffect(() => {
    if (!user) return
    getOrCreateKeyPair()
      .then(async (keyPair) => {
        const pubKey = await exportPublicKey(keyPair.publicKey)
        // Only write if the stored key differs (avoids unnecessary writes)
        const { data: profile } = await supabase
          .from('profiles')
          .select('public_key')
          .eq('id', user.id)
          .single()
        if (profile?.public_key !== pubKey) {
          await supabase.from('profiles').update({ public_key: pubKey }).eq('id', user.id)
        }
      })
      .catch(() => {}) // non-fatal — messages fall back to unencrypted
  }, [user])

  const redirectTo = window.location.origin + (import.meta.env.PROD ? '/mmmh/' : '/')

  const signInWithGoogle = () => {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
  }

  const signInWithEmail = (email, password) => {
    return supabase.auth.signInWithPassword({ email, password })
  }

  const signUpWithEmail = (email, password) => {
    return supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } })
  }

  const signOut = () => {
    return supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
