import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, serverTimestamp, query, where } from "firebase/firestore"
import { db } from "@/services/firebase"

export const getEquipos = async () => {
  const snap = await getDocs(collection(db, "equipos"))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const getEquiposBySemillero = async (semilleroId) => {
  const q = query(collection(db, "equipos"), where("semilleroId", "==", semilleroId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const createEquipo = async ({ nombre, descripcion, color, miembros, memberUids, semilleroId }) => {
  return await addDoc(collection(db, "equipos"), {
    nombre: nombre.trim(),
    descripcion: descripcion?.trim() || "",
    color: color || "295",
    miembros: miembros || [],
    memberUids: memberUids || [],
    semilleroId: semilleroId || null,
    createdAt: serverTimestamp(),
  })
}

export const updateEquipo = async (id, data) => {
  return await updateDoc(doc(db, "equipos", id), data)
}

export const deleteEquipo = async (id) => {
  return await deleteDoc(doc(db, "equipos", id))
}
