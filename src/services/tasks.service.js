import { collection, addDoc, getDocs, deleteDoc, updateDoc, doc, serverTimestamp, orderBy, query } from "firebase/firestore"
import { db } from "@/services/firebase"

export const addTask = async (colleagueId, task, author) => {
  return await addDoc(collection(db, "companeros", colleagueId, "tareas"), {
    titulo: task.titulo.trim(),
    descripcion: task.descripcion?.trim() || "",
    fechaLimite: task.fechaLimite || null,
    estado: "Pendiente",
    creadoPorNombre: author.displayName || author.email,
    creadoPor: author.uid,
    createdAt: serverTimestamp(),
  })
}

export const getTasks = async (colleagueId) => {
  const q = query(collection(db, "companeros", colleagueId, "tareas"), orderBy("createdAt", "desc"))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const updateTaskStatus = async (colleagueId, taskId, estado) => {
  return await updateDoc(doc(db, "companeros", colleagueId, "tareas", taskId), { estado })
}

export const deleteTask = async (colleagueId, taskId) => {
  return await deleteDoc(doc(db, "companeros", colleagueId, "tareas", taskId))
}
