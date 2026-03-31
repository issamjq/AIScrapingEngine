import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import {
  User,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth"
import { auth, googleProvider } from "@/lib/firebase"

interface AuthContextType {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  logout: () => Promise<void>
  error: string | null
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Enforce Gmail-only — reject any non-gmail.com accounts
        const email = firebaseUser.email ?? ""
        if (!email.endsWith("@gmail.com")) {
          signOut(auth)
          setUser(null)
          setError("Only Gmail accounts (@gmail.com) are allowed.")
        } else {
          setUser(firebaseUser)
          setError(null)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const signInWithGoogle = async () => {
    setError(null)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const email = result.user.email ?? ""
      if (!email.endsWith("@gmail.com")) {
        await signOut(auth)
        setError("Only Gmail accounts (@gmail.com) are allowed.")
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign-in failed."
      // Ignore popup-closed-by-user
      if (!msg.includes("popup-closed-by-user")) {
        setError("Sign-in failed. Please try again.")
      }
    }
  }

  const logout = async () => {
    await signOut(auth)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, logout, error }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
