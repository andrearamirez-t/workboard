import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/services/firebase"

export const notificarTareaCompletada = async ({ taskTitle, assigneeName, grupoNombre, path, tipo, semilleroId }) => {
  return await addDoc(collection(db, "notificaciones"), {
    tipo: tipo || "tarea_completada",
    taskTitle,
    assigneeName: assigneeName || null,
    grupoNombre: grupoNombre || null,
    semilleroId: semilleroId || null,
    path,
    createdAt: serverTimestamp(),
  })
}

// Notificación personal al compañero — visible en su campana
export const crearNotificacionUsuario = async ({ toUid, tipo, titulo, subtitulo, path, semilleroId }) => {
  if (!toUid) return null
  return await addDoc(collection(db, "notif_usuario", toUid, "items"), {
    tipo: tipo || "general",
    titulo,
    subtitulo: subtitulo || null,
    semilleroId: semilleroId || null,
    path: path || null,
    createdAt: serverTimestamp(),
  })
}
