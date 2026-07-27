import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/services/firebase"

// Encola notificación de tarea asignada → n8n la recoge y envía por WhatsApp
export const queueTareaNotification = async ({ colleague, tarea, asignadoPor }) => {
  if (!colleague?.whatsapp) return null
  return addDoc(collection(db, "wpp_queue"), {
    tipo: "tarea_asignada",
    whatsapp: String(colleague.whatsapp).replace(/\D/g, ""),
    nombre: colleague.nombre || "",
    tarea: {
      titulo: tarea.titulo || "",
      descripcion: tarea.descripcion || "",
      fechaInicio: tarea.fechaInicio || null,
      fechaLimite: tarea.fechaLimite || null,
      avance: Number(tarea.avance) || 0,
    },
    asignadoPor: asignadoPor || "Admin",
    processed: false,
    createdAt: serverTimestamp(),
  })
}

// Encola notificación a participante importado → n8n la recoge y envía por WhatsApp
// Solo se ejecuta si el grupo NO está marcado como esPrueba
export const queueParticipanteGrupoNotification = async ({ contacto, grupo }) => {
  if (!contacto?.telefono || grupo?.esPrueba) return null
  const tel = String(contacto.telefono).replace(/\D/g, "")
  if (!tel) return null
  return addDoc(collection(db, "wpp_queue"), {
    tipo: "participante_grupo",
    whatsapp: tel,
    nombre: contacto.nombre || "",
    correo: contacto.correo || "",
    grupo: {
      nombre: grupo.nombre || "",
      descripcion: grupo.descripcion || "",
    },
    processed: false,
    createdAt: serverTimestamp(),
  })
}

// Encola notificación de ingreso a grupo → n8n la recoge y envía por WhatsApp
export const queueGrupoNotification = async ({ colleague, grupo }) => {
  if (!colleague?.whatsapp) return null
  return addDoc(collection(db, "wpp_queue"), {
    tipo: "miembro_grupo",
    whatsapp: String(colleague.whatsapp).replace(/\D/g, ""),
    nombre: colleague.nombre || "",
    grupo: {
      nombre: grupo.nombre || "",
      descripcion: grupo.descripcion || "",
      color: grupo.color || null,
    },
    processed: false,
    createdAt: serverTimestamp(),
  })
}
