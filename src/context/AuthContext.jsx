import { createContext, useContext, useEffect, useState } from "react"
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth"
import { auth, googleProvider } from "@/services/firebase"

const ALLOWED_EMAILS = [
  "andrea_ramirezt@cun.edu.co",
  "jose_forero@cun.edu.co",
]

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && !ALLOWED_EMAILS.includes(currentUser.email)) {
        await signOut(auth)
        setAuthError("Este correo no tiene acceso a Workboard.")
        setUser(null)
      } else {
        setAuthError(null)
        setUser(currentUser)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const loginWithGoogle = async () => {
    try {
      setAuthError(null)
      await signInWithPopup(auth, googleProvider)
    } catch (error) {
      console.error("Error login:", error.code, error.message)
    }
  }

  const logout = () => signOut(auth)

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout, authError }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
