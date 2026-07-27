import { createContext, useContext, useEffect, useState } from "react"
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth"
import { doc, getDoc, collection, getDocs, updateDoc, arrayUnion } from "firebase/firestore"
import { auth, googleProvider, db } from "@/services/firebase"
import { getColleagueByEmail, linkColleagueUid } from "@/services/colleagues.service"

// Agrega el uid del usuario a memberUids en todos los grupos donde ya aparece en miembros
async function backfillMemberUids(companionId, uid) {
  try {
    const snap = await getDocs(collection(db, "equipos"))
    const updates = []
    snap.docs.forEach(d => {
      const data = d.data()
      const miembros = data.miembros || []
      const memberUids = data.memberUids || []
      if (miembros.includes(companionId) && !memberUids.includes(uid)) {
        updates.push(updateDoc(doc(db, "equipos", d.id), { memberUids: arrayUnion(uid) }))
      }
    })
    await Promise.all(updates)
  } catch (e) {
    console.error("[Workboard] Error en backfillMemberUids:", e.message)
  }
}

const AuthContext = createContext(null)

const cacheKey = (email) => `wb_cid_${email}`

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)
  const [myColleagueId, setMyColleagueId] = useState(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && !currentUser.email?.endsWith("@cun.edu.co")) {
        await signOut(auth)
        setAuthError("Solo cuentas @cun.edu.co tienen acceso a Workboard.")
        setUser(null)
        setMyColleagueId(null)
      } else if (currentUser) {
        setAuthError(null)
        setUser(currentUser)
        try {
          // 1. Revisar caché local primero (usa getDoc directo, siempre permitido)
          const cached = localStorage.getItem(cacheKey(currentUser.email))
          if (cached) {
            const snap = await getDoc(doc(db, "companeros", cached))
            if (snap.exists()) {
              setMyColleagueId(cached)
              setLoading(false)
              if (!snap.data()?.uid) {
                linkColleagueUid(cached, currentUser.uid).catch(() => {})
                backfillMemberUids(cached, currentUser.uid).catch(() => {})
              }
              return
            }
            // Caché inválido (doc eliminado), limpiar
            localStorage.removeItem(cacheKey(currentUser.email))
          }

          // 2. Query por email (requiere allow read/list en reglas Firestore)
          const companion = await getColleagueByEmail(currentUser.email)
          if (companion) {
            setMyColleagueId(companion.id)
            localStorage.setItem(cacheKey(currentUser.email), companion.id)
            if (!companion.uid) {
              await linkColleagueUid(companion.id, currentUser.uid)
              backfillMemberUids(companion.id, currentUser.uid).catch(() => {})
            }
          } else {
            setMyColleagueId(null)
          }
        } catch (e) {
          console.error("[Workboard] Error vinculando perfil:", e.code, e.message)
          setMyColleagueId(null)
        }
      } else {
        setAuthError(null)
        setUser(null)
        setMyColleagueId(null)
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
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout, authError, myColleagueId }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
