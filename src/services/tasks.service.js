import { collection, addDoc, getDocs, deleteDoc, updateDoc, doc, serverTimestamp, orderBy, query, arrayUnion, arrayRemove, deleteField } from "firebase/firestore"
import { db } from "@/services/firebase"

export const addTask = async (colleagueId, task, author) => {
  return await addDoc(collection(db, "companeros", colleagueId, "tareas"), {
    titulo: task.titulo.trim(),
    descripcion: task.descripcion?.trim() || "",
    fechaInicio: task.fechaInicio || null,
    fechaLimite: task.fechaLimite || null,
    avance: Number(task.avance) || 0,
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

export const updateTask = async (colleagueId, taskId, data) => {
  return await updateDoc(doc(db, "companeros", colleagueId, "tareas", taskId), data)
}

export const updateTaskStatus = async (colleagueId, taskId, estado) => {
  return await updateDoc(doc(db, "companeros", colleagueId, "tareas", taskId), { estado })
}

export const deleteTask = async (colleagueId, taskId) => {
  return await deleteDoc(doc(db, "companeros", colleagueId, "tareas", taskId))
}

export const updateTaskAvance = async (colleagueId, taskId, avance, nuevoEstado) => {
  const data = { avance }
  if (nuevoEstado) data.estado = nuevoEstado
  return await updateDoc(doc(db, "companeros", colleagueId, "tareas", taskId), data)
}

export const addTaskFile = async (colleagueId, taskId, archivo) => {
  return await updateDoc(doc(db, "companeros", colleagueId, "tareas", taskId), { archivos: arrayUnion(archivo) })
}

export const removeTaskFile = async (colleagueId, taskId, archivo) => {
  return await updateDoc(doc(db, "companeros", colleagueId, "tareas", taskId), { archivos: arrayRemove(archivo) })
}

export const solicitarPlazoTask = async (colleagueId, taskId, solicitud) => {
  return await updateDoc(doc(db, "companeros", colleagueId, "tareas", taskId), { solicitudPlazo: solicitud })
}

export const cancelarPlazoTask = async (colleagueId, taskId) => {
  return await updateDoc(doc(db, "companeros", colleagueId, "tareas", taskId), { solicitudPlazo: deleteField() })
}
