import {
  collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp
} from "firebase/firestore"
import { db } from "@/services/firebase"

export const getSemilleros = async () => {
  const snap = await getDocs(collection(db, "semilleros"))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const getSemillero = async (id) => {
  const snap = await getDoc(doc(db, "semilleros", id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export const createSemillero = async (data, createdByUid) => {
  return await addDoc(collection(db, "semilleros"), {
    nombre: data.nombre,
    descripcion: data.descripcion || "",
    color: data.color || "165",
    coordinadores: data.coordinadores || [],
    createdBy: createdByUid,
    createdAt: serverTimestamp(),
  })
}

export const updateSemillero = async (id, data) => {
  return await updateDoc(doc(db, "semilleros", id), data)
}

export const deleteSemillero = async (id) => {
  return await deleteDoc(doc(db, "semilleros", id))
}

export const getSemillerosByCoordinador = async (uid) => {
  const q = query(collection(db, "semilleros"), where("coordinadores", "array-contains", uid))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
