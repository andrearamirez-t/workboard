import { doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from "firebase/firestore"
import { db } from "@/services/firebase"

export const ensureUsuarioDoc = async (uid, { email, nombre } = {}) => {
  const ref = doc(db, "usuarios", uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    const data = {
      email: email || "",
      nombre: nombre || (email ? email.split("@")[0] : ""),
      role: "member",
      semilleroId: null,
      createdAt: serverTimestamp(),
    }
    await setDoc(ref, data)
    return data
  }
  return snap.data()
}

export const getUsuarioDoc = async (uid) => {
  const snap = await getDoc(doc(db, "usuarios", uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export const setUsuarioRole = async (uid, role, semilleroId = null) => {
  await setDoc(doc(db, "usuarios", uid), { role, semilleroId }, { merge: true })
}

export const getAllUsuarios = async () => {
  const snap = await getDocs(collection(db, "usuarios"))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
