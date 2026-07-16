import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/services/firebase"

export const notificarTareaCompletada = async ({ taskTitle, assigneeName, grupoNombre, path, tipo }) => {
  return await addDoc(collection(db, "notificaciones"), {
    tipo: tipo || "tarea_completada",
    taskTitle,
    assigneeName: assigneeName || null,
    grupoNombre: grupoNombre || null,
    path,
    createdAt: serverTimestamp(),
  })
}
