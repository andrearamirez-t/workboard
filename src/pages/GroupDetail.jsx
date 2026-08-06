import { useEffect, useState, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { Footer } from "@/components/ui/Footer"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import EmojiPicker from "emoji-picker-react"
import {
  getGrupo, addGrupoProject, deleteGrupoProject, updateGrupoProject,
  addGrupoLog, getGrupoLogs, deleteGrupoLog, updateGrupoLog,
  addGrupoTask, getGrupoTasks, updateGrupoTask, updateGrupoTaskStatus, deleteGrupoTask, updateGrupoTaskAvance,
  addGrupoFeedback, getGrupoFeedback, deleteGrupoFeedback, updateGrupoFeedback,
  solicitarPlazoGrupoTask, aceptarPlazoGrupoTask, rechazarPlazoGrupoTask, dismissPlazoGrupoResultado,
  addGrupoTaskFile, removeGrupoTaskFile,
  importGroupContacts, getGroupContacts, deleteGroupContact, deleteAllGroupContacts,
} from "@/services/groups.service"
import { parseContactsFile } from "@/utils/parseContactsFile"
import { notificarTareaCompletada, crearNotificacionUsuario } from "@/services/notificaciones.service"
import { getColleagues, addProject } from "@/services/colleagues.service"
import { uploadGroupDocument, getGroupDocuments, deleteGroupDocument, uploadGrupoTaskFile, deleteTaskFile, MAX_FILE_SIZE } from "@/services/storage.service"
import { Pencil, Trash2, Check, X, Plus, ChevronDown, ChevronUp } from "lucide-react"
import { downloadFile } from "@/utils/download"

function getFileTypeInfo(tipo, nombre) {
  const ext = (nombre || "").split(".").pop().toLowerCase()
  if (tipo?.includes("pdf") || ext === "pdf")       return { label: "PDF", color: "oklch(0.50 0.22 27)",  bg: "oklch(0.65 0.22 27 / 0.15)"  }
  if (tipo?.includes("word") || ["doc","docx"].includes(ext)) return { label: "DOC", color: "oklch(0.50 0.20 260)", bg: "oklch(0.62 0.18 260 / 0.15)" }
  if (tipo?.includes("sheet") || tipo?.includes("excel") || ["xls","xlsx"].includes(ext)) return { label: "XLS", color: "oklch(0.50 0.18 145)", bg: "oklch(0.55 0.18 145 / 0.15)" }
  if (tipo?.includes("presentation") || ["ppt","pptx"].includes(ext)) return { label: "PPT", color: "oklch(0.55 0.22 35)", bg: "oklch(0.65 0.20 35 / 0.15)" }
  if (tipo?.includes("image") || ["jpg","jpeg","png","gif","webp"].includes(ext)) return { label: "IMG", color: "oklch(0.50 0.18 295)", bg: "oklch(0.62 0.18 295 / 0.15)" }
  return { label: "FILE", color: "oklch(0.55 0.04 270)", bg: "oklch(0.55 0.04 270 / 0.15)" }
}

function formatFileSize(bytes) {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const ADMIN_EMAILS = ["andrea_ramirezt@cun.edu.co", "angela_bernalm@cun.edu.co", "jose_forero@cun.edu.co"]

const ESTADOS = ["Planificación", "En desarrollo", "En revisión", "Finalizado", "Pausado", "Entregado"]
const STATE_COLOR = {
  "Planificación": "260", "En desarrollo": "145", "En revisión": "55",
  "Finalizado": "145", "Pausado": "27", "Entregado": "295",
}

function hashHue(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return Math.abs(h * 137.508) % 360
}

function avanceColor(v) {
  return v >= 75 ? "oklch(0.55 0.18 145)" : v >= 50 ? "oklch(0.55 0.18 260)" : v >= 25 ? "oklch(0.60 0.18 55)" : "oklch(0.60 0.20 27)"
}

const EMPTY_PROJECT = { nombre: "", estado: "En desarrollo", avance: 0, area: "", queHace: "", herramientas: "", fechaInicio: "", fechaEntrega: "", observaciones: "" }

export default function GroupDetail() {
  const { id, semilleroId } = useParams()
  const navigate = useNavigate()
  const { user, myColleagueId } = useAuth()
  const isAdmin = ADMIN_EMAILS.includes(user?.email)

  const [grupo, setGrupo] = useState(null)
  const [colleagues, setColleagues] = useState([])
  const [logs, setLogs] = useState([])
  const [tasks, setTasks] = useState([])
  const [feedback, setFeedback] = useState([])

  //Bitácora
  const [nota, setNota] = useState("")
  const [savingLog, setSavingLog] = useState(false)
  const [editingLogId, setEditingLogId] = useState(null)
  const [editingLogText, setEditingLogText] = useState("")
  const [showEmoji, setShowEmoji] = useState(false)
  const notaRef = useRef(null)

  // Proyectos
  const [showProjectForm, setShowProjectForm] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [projectForm, setProjectForm] = useState(EMPTY_PROJECT)
  const [savingProject, setSavingProject] = useState(false)
  const [projectSearch, setProjectSearch] = useState("")
  const [returningProject, setReturningProject] = useState(null)
  const [returnTargetId, setReturnTargetId] = useState("")
  const [savingReturn, setSavingReturn] = useState(false)

  // Documentos
  const fileInputRef = useRef(null)
  const uploadingProjectRef = useRef(null) // ref para evitar stale closure
  const taskFileInputRef = useRef(null)
  const uploadingTaskIdRef = useRef(null)
  const [groupDocuments, setGroupDocuments] = useState([])
  const [uploadProgress, setUploadProgress] = useState(null)
  const [uploadError, setUploadError] = useState("")
  const [uploadingForProject, setUploadingForProject] = useState(null)
  const [openDocProjects, setOpenDocProjects] = useState(new Set())

  // Tareas
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [taskForm, setTaskForm] = useState({ titulo: "", descripcion: "", fechaInicio: "", fechaLimite: "", avance: 0 })
  const [savingTask, setSavingTask] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editingTaskForm, setEditingTaskForm] = useState({})
  const [solicitudPlazoId, setSolicitudPlazoId] = useState(null)
  const [solicitudMotivo, setSolicitudMotivo] = useState("")
  const [solicitudFecha, setSolicitudFecha] = useState("")
  const [savingSolicitud, setSavingSolicitud] = useState(false)
  const [editandoSolicitudId, setEditandoSolicitudId] = useState(null)
  const [aceptandoPlazoId, setAceptandoPlazoId] = useState(null)
  const [fechaAceptar, setFechaAceptar] = useState("")
  const [savingPlazo, setSavingPlazo] = useState(false)
  const [taskAvanceLocal, setTaskAvanceLocal] = useState({})
  const [savingAvance, setSavingAvance] = useState(null)
  const [openTaskFiles, setOpenTaskFiles] = useState(new Set())
  const [taskFileProgress, setTaskFileProgress] = useState(null)
  const [taskFileError, setTaskFileError] = useState("")

  // Retroalimentación
  const [feedbackText, setFeedbackText] = useState("")
  const [savingFeedback, setSavingFeedback] = useState(false)
  const [editingFbId, setEditingFbId] = useState(null)
  const [editingFbText, setEditingFbText] = useState("")

  // Contactos importados
  const contactsInputRef = useRef(null)
  const [contacts, setContacts] = useState([])
  const [importPreview, setImportPreview] = useState(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState("")
  const [importSaving, setImportSaving] = useState(false)
  const [contactSearch, setContactSearch] = useState("")

  // Secciones colapsables
  const [openSections, setOpenSections] = useState({ proyectos: true, bitacora: true, tareas: true, feedback: true, contactos: true })
  const toggleSection = (s) => setOpenSections(prev => ({ ...prev, [s]: !prev[s] }))

  const [loadingData, setLoadingData] = useState(true)

  // ── Carga de datos ──────────────────────────────────────────────────────
  const loadAll = async () => {
    setLoadingData(true)
    try {
      const [g, cols] = await Promise.all([getGrupo(id), getColleagues()])
      setGrupo(g)
      setColleagues(cols)
      // compute membership immediately so we can gate the rest
      const member = g && (g.miembros || []).some(cid => {
        const c = cols.find(col => col.id === cid)
        return c && (c.uid === user?.uid || c.email === user?.email)
      })
      if (isAdmin || member) {
        const [ls, ts, fb, docs] = await Promise.all([
          getGrupoLogs(id),
          getGrupoTasks(id),
          getGrupoFeedback(id),
          getGroupDocuments(id),
        ])
        setLogs(ls)
        setTasks(ts)
        setFeedback(fb)
        setGroupDocuments(docs)
      }
    } finally { setLoadingData(false) }
  }

  useEffect(() => { loadAll() }, [id])

  // Carga de contactos separada
  useEffect(() => {
    if (!id || !user) return
    getGroupContacts(id)
      .then(cts => setContacts(cts))
      .catch(() => setContacts([]))
  }, [id, user])

  const isMember = grupo && (grupo.miembros || []).some(cid => {
    const c = colleagues.find(col => col.id === cid)
    return c && (c.uid === user?.uid || c.email === user?.email)
  })
  const canAccess = isAdmin || isMember
  const canLog = isAdmin || isMember

  // ── Importar contactos desde Excel/CSV ───────────────────────────────────
  const handleContactsFileSelected = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    setImportError("")
    setImportLoading(true)
    try {
      const parsed = await parseContactsFile(file)
      setImportPreview(parsed)
    } catch (err) {
      setImportError(err.message)
    } finally {
      setImportLoading(false)
    }
  }

  const handleConfirmImport = async () => {
    if (!importPreview?.length) return
    setImportSaving(true)
    try {
      await importGroupContacts(id, importPreview, user?.email)
      const updated = await getGroupContacts(id)
      setContacts(updated)
      setImportPreview(null)
    } catch (err) {
      setImportError("Error al guardar los contactos. Intenta de nuevo.")
    } finally {
      setImportSaving(false)
    }
  }

  const handleDeleteContact = async (contactId) => {
    await deleteGroupContact(id, contactId)
    setContacts(prev => prev.filter(c => c.id !== contactId))
  }

  const handleDeleteAllContacts = async () => {
    if (!window.confirm(`¿Eliminar todos los contactos importados de este grupo?`)) return
    await deleteAllGroupContacts(id)
    setContacts([])
  }

  // ── Documentos de grupo ───────────────────────────────────────────────────
  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    // Usar el ref como fuente de verdad (evita stale closure de estado React)
    const proyNombre = uploadingProjectRef.current
    if (!proyNombre) return
    if (file.size > MAX_FILE_SIZE) { setUploadError("El archivo supera el límite de 15 MB."); return }
    setUploadError("")
    setUploadProgress(0)
    try {
      const newDoc = await uploadGroupDocument(id, file, {
        onProgress: setUploadProgress,
        uploadedBy: user?.uid,
        uploadedByName: user?.displayName || user?.email,
        proyectoNombre: String(proyNombre),
      })
      setGroupDocuments(prev => [newDoc, ...prev])
    } catch (err) {
      console.error("[Workboard] Error subiendo archivo al grupo:", err)
      setUploadError("No se pudo subir el archivo.")
    } finally {
      setUploadProgress(null)
      uploadingProjectRef.current = null
    }
  }

  const handleDeleteGroupDoc = async (d) => {
    if (!window.confirm(`¿Eliminar "${d.nombre}"?`)) return
    try {
      await deleteGroupDocument(id, d.id, d.storagePath)
      setGroupDocuments(prev => prev.filter(x => x.id !== d.id))
    } catch (err) { console.error(err) }
  }

  // ── Bitácora ─────────────────────────────────────────────────────────────
  const handleAddLog = async () => {
    if (!nota.trim()) return
    setSavingLog(true)
    try {
      await addGrupoLog(id, nota.trim(), user)
      setNota("")
      setLogs(await getGrupoLogs(id))
    } finally { setSavingLog(false) }
  }

  const handleDeleteLog = async (logId) => {
    await deleteGrupoLog(id, logId)
    setLogs(prev => prev.filter(l => l.id !== logId))
  }

  const handleSaveEditLog = async (logId) => {
    if (!editingLogText.trim()) return
    await updateGrupoLog(id, logId, editingLogText.trim())
    setLogs(prev => prev.map(l => l.id === logId ? { ...l, nota: editingLogText.trim() } : l))
    setEditingLogId(null)
  }

  // ── Proyectos ─────────────────────────────────────────────────────────────
  const handleSaveProject = async () => {
    if (!projectForm.nombre.trim()) return
    setSavingProject(true)
    try {
      const data = {
        ...projectForm,
        avance: Number(projectForm.avance),
        herramientas: projectForm.herramientas ? projectForm.herramientas.split(",").map(s => s.trim()).filter(Boolean) : [],
      }
      if (editingProject) {
        await updateGrupoProject(id, editingProject, data)
      } else {
        await addGrupoProject(id, data)
        notificarMiembros({
          tipo: "proyecto_grupo",
          titulo: `Nuevo proyecto en "${grupo?.nombre}"`,
          subtitulo: data.nombre,
          path: `/semillero/${semilleroId}/grupo/${id}`,
        })
      }
      const g = await getGrupo(id)
      setGrupo(g)
      setShowProjectForm(false)
      setEditingProject(null)
      setProjectForm(EMPTY_PROJECT)
    } finally { setSavingProject(false) }
  }

  const handleDeleteProject = async (proyecto) => {
    await deleteGrupoProject(id, proyecto)
    setGrupo(prev => ({ ...prev, proyectos: (prev.proyectos || []).filter(p => p !== proyecto) }))
  }

  const handleReturnProject = (proyecto) => {
    if (proyecto.enrutadoDe) {
      // Nuevo comportamiento: el proyecto ya está en el perfil individual, solo quitar del grupo
      deleteGrupoProject(id, proyecto)
      setGrupo(prev => ({ ...prev, proyectos: (prev.proyectos || []).filter(p => p !== proyecto) }))
    } else {
      // Proyecto antiguo (enrutado antes del fix): hay que elegir a qué compañera devolverlo
      setReturnTargetId("")
      setReturningProject(proyecto)
    }
  }

  const handleConfirmReturn = async () => {
    const targetId = returnTargetId || miembros[0]?.id
    if (!returningProject || !targetId) return
    setSavingReturn(true)
    try {
      const { enrutadoDe, ...raw } = returningProject
      // Normalizar al formato exacto que espera el perfil individual (ProjectForm)
      const projectData = {
        nombre: raw.nombre || "",
        estado: raw.estado || "",
        avance: Number(raw.avance) || 0,
        area: raw.area || "",
        queHace: raw.queHace || "",
        herramientas: Array.isArray(raw.herramientas)
          ? raw.herramientas
          : (raw.herramientas || "").split(",").map(h => h.trim()).filter(Boolean),
        observaciones: raw.observaciones || "",
        fechaInicio: raw.fechaInicio || "",
        fechaEntrega: raw.fechaEntrega || "",
        versiones: raw.versiones || [],
      }
      await addProject(targetId, projectData)
      await deleteGrupoProject(id, returningProject)
      setGrupo(prev => ({ ...prev, proyectos: (prev.proyectos || []).filter(p => p !== returningProject) }))
      setReturningProject(null)
    } catch (err) {
      console.error("[Workboard] Error devolviendo proyecto a individual:", err)
    } finally {
      setSavingReturn(false)
    }
  }

  const openEditProject = (p) => {
    setEditingProject(p)
    setProjectForm({ ...p, herramientas: (p.herramientas || []).join(", ") })
    setShowProjectForm(true)
  }

  // Notifica a todos los miembros del grupo que no son admin
  const notificarMiembros = ({ tipo, titulo, subtitulo, path: p }) => {
    const memberColleagues = colleagues.filter(c => (grupo?.miembros || []).includes(c.id))
    memberColleagues.forEach(c => {
      if (!c.uid || ADMIN_EMAILS.includes(c.email)) return
      crearNotificacionUsuario({ toUid: c.uid, tipo, titulo, subtitulo, path: p, semilleroId }).catch(() => {})
    })
  }

  // ── Tareas ────────────────────────────────────────────────────────────────
  const handleAddTask = async () => {
    if (!taskForm.titulo.trim()) return
    setSavingTask(true)
    try {
      await addGrupoTask(id, taskForm)
      if (Number(taskForm.avance) >= 100) {
        notificarTareaCompletada({ taskTitle: taskForm.titulo.trim(), grupoNombre: grupo?.nombre, path: `/semillero/${semilleroId}/grupo/${id}`, semilleroId }).catch(() => {})
      }
      // Notificar a los miembros del grupo
      notificarMiembros({
        tipo: "tarea_grupo",
        titulo: `Nueva tarea en "${grupo?.nombre}"`,
        subtitulo: taskForm.titulo.trim(),
        path: `/semillero/${semilleroId}/grupo/${id}`,
      })
      setTasks(await getGrupoTasks(id))
      setTaskForm({ titulo: "", descripcion: "", fechaInicio: "", fechaLimite: "", avance: 0 })
      setShowTaskForm(false)
    } finally { setSavingTask(false) }
  }

  const handleTaskStatus = async (taskId, estado) => {
    await updateGrupoTaskStatus(id, taskId, estado)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, estado } : t))
    if (estado === "Hecho") {
      const task = tasks.find(t => t.id === taskId)
      notificarTareaCompletada({
        taskTitle: task?.titulo,
        grupoNombre: grupo?.nombre,
        path: `/semillero/${semilleroId}/grupo/${id}`,
        semilleroId,
      }).catch(() => {})
      notificarMiembros({
        tipo: "tarea_completada_grupo",
        titulo: `Tarea completada en "${grupo?.nombre}"`,
        subtitulo: task?.titulo,
        path: `/semillero/${semilleroId}/grupo/${id}`,
      })
    }
  }

  const handleDeleteTask = async (taskId) => {
    await deleteGrupoTask(id, taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  const handleSolicitarPlazo = async (taskId) => {
    if (!solicitudMotivo.trim()) return
    setSavingSolicitud(true)
    const miembrosLocal = (grupo?.miembros || []).map(cid => colleagues.find(c => c.id === cid)).filter(Boolean)
    const yo = miembrosLocal.find(m => m.id === myColleagueId)
    try {
      await solicitarPlazoGrupoTask(id, taskId, {
        motivo: solicitudMotivo.trim(),
        fechaPropuesta: solicitudFecha || null,
        solicitadoPor: yo?.nombre || user?.displayName || user?.email,
        fecha: new Date().toISOString(),
      })
      setSolicitudPlazoId(null)
      setSolicitudMotivo("")
      setSolicitudFecha("")
      setTasks(await getGrupoTasks(id))
      notificarTareaCompletada({
        tipo: "plazo_solicitado",
        taskTitle: `Solicitud de plazo en "${grupo?.nombre}"`,
        assigneeName: yo?.nombre || user?.displayName || user?.email,
        path: `/semillero/${semilleroId}/grupo/${id}`,
        semilleroId,
      }).catch(() => {})
    } catch (err) {
      console.error("[Workboard] Error solicitando plazo grupo:", err)
    } finally {
      setSavingSolicitud(false)
    }
  }

  const handleAceptarPlazo = async (task) => {
    const fechaPropuesta = task.solicitudPlazo?.fechaPropuesta
    if (!fechaPropuesta && !fechaAceptar) {
      setAceptandoPlazoId(task.id)
      setFechaAceptar("")
      return
    }
    setSavingPlazo(true)
    try {
      await aceptarPlazoGrupoTask(id, task.id, fechaPropuesta || fechaAceptar)
      setAceptandoPlazoId(null)
      setFechaAceptar("")
      setTasks(await getGrupoTasks(id))
    } catch (err) {
      console.error("[Workboard] Error aceptando plazo grupo:", err)
    } finally {
      setSavingPlazo(false)
    }
  }

  const handleRechazarPlazo = async (taskId) => {
    setSavingPlazo(true)
    try {
      await rechazarPlazoGrupoTask(id, taskId)
      setTasks(await getGrupoTasks(id))
    } catch (err) {
      console.error("[Workboard] Error rechazando plazo grupo:", err)
    } finally {
      setSavingPlazo(false)
    }
  }

  const handleUpdateAvance = async (taskId, newAvance) => {
    setSavingAvance(taskId)
    try {
      const task = tasks.find(t => t.id === taskId)
      const nuevoEstado = newAvance >= 100 ? "Hecho" : undefined
      await updateGrupoTaskAvance(id, taskId, newAvance, nuevoEstado)
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, avance: newAvance, ...(nuevoEstado ? { estado: nuevoEstado } : {}) } : t))
      if (newAvance >= 100 && task?.estado !== "Hecho") {
        notificarTareaCompletada({ taskTitle: task?.titulo, grupoNombre: grupo?.nombre, path: `/semillero/${semilleroId}/grupo/${id}`, semilleroId }).catch(() => {})
        notificarMiembros({ tipo: "tarea_completada_grupo", titulo: `Tarea completada en "${grupo?.nombre}"`, subtitulo: task?.titulo, path: `/semillero/${semilleroId}/grupo/${id}` })
      }
    } catch (err) {
      console.error("[Workboard] Error actualizando avance de tarea:", err)
    } finally {
      setSavingAvance(null)
      setTaskAvanceLocal(prev => { const n = { ...prev }; delete n[taskId]; return n })
    }
  }

  const handleGroupTaskFileSelected = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    const taskId = uploadingTaskIdRef.current
    if (!taskId) return
    if (file.size > MAX_FILE_SIZE) { setTaskFileError("El archivo supera 15 MB."); return }
    setTaskFileError("")
    setTaskFileProgress({ taskId, progress: 0 })
    try {
      const archivo = await uploadGrupoTaskFile(id, taskId, file, { onProgress: p => setTaskFileProgress({ taskId, progress: p }) })
      await addGrupoTaskFile(id, taskId, archivo)
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, archivos: [...(t.archivos || []), archivo] } : t))
    } catch (err) {
      console.error("[Workboard] Error subiendo archivo de tarea:", err)
      setTaskFileError("Error al subir el archivo.")
    } finally {
      setTaskFileProgress(null)
      uploadingTaskIdRef.current = null
    }
  }

  const handleDeleteGroupTaskFile = async (taskId, archivo) => {
    if (!window.confirm(`¿Eliminar "${archivo.nombre}"?`)) return
    try {
      await deleteTaskFile(archivo.storagePath)
      await removeGrupoTaskFile(id, taskId, archivo)
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, archivos: (t.archivos || []).filter(a => a.storagePath !== archivo.storagePath) } : t))
    } catch (err) {
      console.error("[Workboard] Error eliminando archivo de tarea:", err)
    }
  }

  const handleSaveEditTask = async (task) => {
    if (!editingTaskForm.titulo?.trim()) return
    const prevAvance = task.avance ?? 0
    const newAvance = Number(editingTaskForm.avance) || 0
    const data = {
      titulo: editingTaskForm.titulo.trim(),
      descripcion: editingTaskForm.descripcion?.trim() || "",
      fechaInicio: editingTaskForm.fechaInicio || null,
      fechaLimite: editingTaskForm.fechaLimite || null,
      avance: newAvance,
    }
    await updateGrupoTask(id, task.id, data)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...data } : t))
    if (prevAvance < 100 && newAvance >= 100) {
      notificarTareaCompletada({ taskTitle: data.titulo, grupoNombre: grupo?.nombre, path: `/semillero/${semilleroId}/grupo/${id}`, semilleroId }).catch(() => {})
    }
    setEditingTaskId(null)
  }

  // ── Retroalimentación ─────────────────────────────────────────────────────
  const handleAddFeedback = async () => {
    if (!feedbackText.trim()) return
    setSavingFeedback(true)
    try {
      await addGrupoFeedback(id, feedbackText.trim(), user)
      // Notificar a los miembros del grupo
      notificarMiembros({
        tipo: "feedback_grupo",
        titulo: `Nuevo feedback en "${grupo?.nombre}"`,
        subtitulo: feedbackText.trim().slice(0, 80),
        path: `/semillero/${semilleroId}/grupo/${id}`,
      })
      setFeedbackText("")
      setFeedback(await getGrupoFeedback(id))
    } finally { setSavingFeedback(false) }
  }

  const handleDeleteFeedback = async (fbId) => {
    await deleteGrupoFeedback(id, fbId)
    setFeedback(prev => prev.filter(f => f.id !== fbId))
  }

  const handleSaveEditFeedback = async (fbId) => {
    if (!editingFbText.trim()) return
    await updateGrupoFeedback(id, fbId, editingFbText.trim())
    setFeedback(prev => prev.map(f => f.id === fbId ? { ...f, texto: editingFbText.trim() } : f))
    setEditingFbId(null)
  }

  if (loadingData || !grupo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-6 h-6 rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <p className="text-[15px] font-semibold text-foreground">Sin acceso</p>
        <p className="text-[13px] text-muted-foreground">Solo los miembros del grupo pueden ver este contenido.</p>
        <button onClick={() => navigate(`/semillero/${semilleroId}/dashboard`)} className="text-[13px] text-primary hover:underline mt-2">← Volver al dashboard</button>
      </div>
    )
  }

  const hue = grupo.color || "295"
  const miembros = (grupo.miembros || []).map(cid => colleagues.find(c => c.id === cid)).filter(Boolean)
  const proyectos = (grupo.proyectos || []).filter(p =>
    !projectSearch || p.nombre?.toLowerCase().includes(projectSearch.toLowerCase())
  )
  const tareasPendientes = tasks.filter(t => t.estado !== "Hecho")
  const tareasHechas = tasks.filter(t => t.estado === "Hecho")

  const inputCls = "w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/30"
  const labelCls = "text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1"
  const sectionHeaderCls = "flex items-center justify-between mb-4 cursor-pointer select-none"

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-border/60 px-6 py-3 flex justify-between items-center"
        style={{ backgroundColor: "color-mix(in srgb, var(--background) 85%, transparent)", backdropFilter: "blur(20px)" }}>
        <button onClick={() => navigate(`/semillero/${semilleroId}/dashboard?tab=equipos`)}
          className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors">
          ← Volver
        </button>
        <ThemeToggle />
      </header>

      {/* ── Hero banner ── */}
      <div className="relative overflow-hidden px-6 py-10"
        style={{ background: "linear-gradient(125deg, oklch(0.46 0.13 165) 0%, oklch(0.40 0.14 185) 45%, oklch(0.48 0.14 245) 100%)" }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-72 h-72 opacity-30"
            style={{ background: "radial-gradient(circle at top right, oklch(0.62 0.14 165), transparent 65%)", filter: "blur(40px)" }} />
          <div className="absolute bottom-0 left-0 w-48 h-48 opacity-20"
            style={{ background: "radial-gradient(circle, oklch(0.58 0.16 295), transparent 65%)", filter: "blur(30px)" }} />
        </div>
        <div className="max-w-4xl mx-auto w-full relative">
          <div className="flex flex-col sm:flex-row sm:items-end gap-5">
            <div className="w-16 h-16 rounded-2xl flex-shrink-0 flex items-center justify-center text-white font-bold text-2xl"
              style={{
                background: "linear-gradient(135deg, oklch(0.62 0.18 165), oklch(0.54 0.22 205))",
                boxShadow: "0 12px 32px oklch(0.52 0.13 165 / 45%), 0 0 0 2px oklch(0.68 0.12 165 / 30%)",
              }}>
              {grupo.nombre?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-[26px] font-bold text-white leading-tight tracking-tight">{grupo.nombre}</h1>
              {grupo.descripcion && <p className="text-[13px] text-white/75 mt-0.5">{grupo.descripcion}</p>}
              {miembros.length > 0 && (
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <div className="flex -space-x-2">
                    {miembros.slice(0, 6).map(c => {
                      const ch = c.colorHue ?? hashHue(c.id)
                      return (
                        <a key={c.id} href={`/semillero/${semilleroId}/colleague/${c.id}`}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[11px] ring-2 flex-shrink-0 hover:z-10 hover:scale-110 transition-transform overflow-hidden"
                          style={{
                            background: c.avatarUrl ? "var(--muted)" : `linear-gradient(135deg, oklch(0.68 0.18 ${ch}), oklch(0.54 0.22 ${(ch+40)%360}))`,
                            ringColor: "oklch(0.46 0.13 165)",
                          }}
                          title={c.nombre}>
                          {c.avatarUrl
                            ? <img src={c.avatarUrl} alt={c.nombre} className="w-full h-full object-cover" />
                            : c.avatarEmoji
                              ? <span className="text-sm leading-none">{c.avatarEmoji}</span>
                              : c.nombre?.charAt(0).toUpperCase()
                          }
                        </a>
                      )
                    })}
                    {miembros.length > 6 && (
                      <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-semibold text-white ring-2 ring-white/20">
                        +{miembros.length - 6}
                      </div>
                    )}
                  </div>
                  <span className="text-[12px] text-white/70">{miembros.length} miembro{miembros.length !== 1 ? "s" : ""}</span>
                  {contacts.length > 0 && (
                    <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: "oklch(0.30 0.06 165)", color: "oklch(0.88 0.08 165)" }}>
                      {contacts.length} participante{contacts.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="px-6 py-8 max-w-4xl mx-auto w-full flex-1 space-y-6">

        {/* ══ PROYECTOS ══════════════════════════════════════════════════════ */}
        <section className="bg-card border border-border rounded-2xl p-5">
          <div className={sectionHeaderCls} onClick={() => toggleSection("proyectos")}>
            <div className="flex items-center gap-3">
              <h2 className="text-[16px] font-bold text-foreground">Proyectos</h2>
              <span className="text-[12px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{grupo.proyectos?.length || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              {(isAdmin || isMember) && openSections.proyectos && (
                <button onClick={e => { e.stopPropagation(); setEditingProject(null); setProjectForm(EMPTY_PROJECT); setShowProjectForm(v => !v) }}
                  className="flex items-center gap-1 text-[12px] font-medium px-3 py-1 rounded-lg"
                  style={{ background: `oklch(0.62 0.22 ${hue} / 0.12)`, color: `oklch(0.52 0.22 ${hue})` }}>
                  <Plus size={12} /> Proyecto
                </button>
              )}
              {openSections.proyectos ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
            </div>
          </div>

          {openSections.proyectos && (
            <>
              {/* Formulario proyecto */}
              {showProjectForm && (isAdmin || isMember) && (
                <div className="bg-muted/40 border border-border rounded-xl p-4 mb-4 space-y-3">
                  <p className="text-[13px] font-semibold text-foreground">{editingProject ? "Editar proyecto" : "Nuevo proyecto"}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className={labelCls}>Nombre *</p>
                      <input placeholder="Nombre del proyecto" value={projectForm.nombre}
                        onChange={e => setProjectForm(f => ({ ...f, nombre: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <p className={labelCls}>Estado</p>
                      <select value={projectForm.estado} onChange={e => setProjectForm(f => ({ ...f, estado: e.target.value }))}
                        className={inputCls}>
                        {ESTADOS.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className={labelCls}>Área</p>
                      <input placeholder="Área o enfoque" value={projectForm.area}
                        onChange={e => setProjectForm(f => ({ ...f, area: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <p className={labelCls}>Herramientas (separadas por coma)</p>
                      <input placeholder="React, Firebase, Python…" value={projectForm.herramientas}
                        onChange={e => setProjectForm(f => ({ ...f, herramientas: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <p className={labelCls}>Fecha inicio</p>
                      <input type="date" value={projectForm.fechaInicio}
                        onChange={e => setProjectForm(f => ({ ...f, fechaInicio: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <p className={labelCls}>Fecha entrega</p>
                      <input type="date" value={projectForm.fechaEntrega}
                        onChange={e => setProjectForm(f => ({ ...f, fechaEntrega: e.target.value }))} className={inputCls} />
                    </div>
                    <div className="sm:col-span-2">
                      <p className={labelCls}>Qué hace</p>
                      <textarea placeholder="Descripción del proyecto…" value={projectForm.queHace}
                        onChange={e => setProjectForm(f => ({ ...f, queHace: e.target.value }))}
                        rows={2} className={inputCls + " resize-none"} />
                    </div>
                    <div className="sm:col-span-2">
                      <p className={labelCls}>Avance: {projectForm.avance}%</p>
                      <input type="range" min="0" max="100" step="5" value={projectForm.avance}
                        onChange={e => setProjectForm(f => ({ ...f, avance: e.target.value }))}
                        className="w-full accent-primary" />
                    </div>
                    <div className="sm:col-span-2">
                      <p className={labelCls}>Observaciones</p>
                      <textarea placeholder="Notas adicionales…" value={projectForm.observaciones}
                        onChange={e => setProjectForm(f => ({ ...f, observaciones: e.target.value }))}
                        rows={2} className={inputCls + " resize-none"} />
                    </div>
                  </div>
                  {/* ── Archivos del proyecto (solo en edición) ── */}
                  {editingProject && (() => {
                    const editProjName = editingProject?.nombre || editingProject
                    const proyDocs = groupDocuments.filter(d => d.proyectoNombre === editProjName)
                    const isUploading = uploadingForProject === editProjName && uploadProgress !== null
                    return (
                      <div className="border-t border-border pt-3 mt-1">
                        <div className="flex items-center justify-between mb-2">
                          <p className={labelCls + " mb-0"}>Archivos del proyecto</p>
                          <button
                            type="button"
                            onClick={() => { uploadingProjectRef.current = editProjName; setUploadingForProject(editProjName); fileInputRef.current?.click() }}
                            disabled={uploadProgress !== null}
                            className="text-[11px] font-semibold px-3 py-1 rounded-lg text-white disabled:opacity-50 transition-all hover:opacity-90"
                            style={{ background: `oklch(0.52 0.22 ${hue})` }}>
                            {isUploading ? `${uploadProgress}%` : "↑ Subir archivo"}
                          </button>
                        </div>
                        {isUploading && (
                          <div className="h-1 rounded-full bg-muted overflow-hidden mb-2">
                            <div className="h-full rounded-full transition-all duration-200"
                              style={{ width: `${uploadProgress}%`, background: `oklch(0.52 0.22 ${hue})` }} />
                          </div>
                        )}
                        {uploadingForProject === editProjName && uploadError && (
                          <p className="text-[11px] text-destructive mb-2">{uploadError}</p>
                        )}
                        {proyDocs.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground italic">Sin archivos aún.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {proyDocs.map(d => {
                              const fi = getFileTypeInfo(d.tipo, d.nombre)
                              return (
                                <div key={d.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border/60 bg-background/60">
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                                    style={{ color: fi.color, backgroundColor: fi.bg }}>{fi.label}</span>
                                  <span className="flex-1 text-[11px] text-foreground truncate">{d.nombre}</span>
                                  {d.size && <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatFileSize(d.size)}</span>}
                                  <button type="button" onClick={() => downloadFile(d.url, d.nombre)}
                                    className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0" title="Descargar">↓</button>
                                  {isAdmin && (
                                    <button type="button" onClick={() => handleDeleteGroupDoc(d)}
                                      className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">×</button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveProject} disabled={savingProject}>
                      {savingProject ? "Guardando…" : editingProject ? "Actualizar" : "Crear proyecto"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setShowProjectForm(false); setEditingProject(null) }}>Cancelar</Button>
                  </div>
                </div>
              )}

              {/* Buscador */}
              {(grupo.proyectos?.length || 0) > 3 && (
                <input placeholder="Buscar proyecto…" value={projectSearch}
                  onChange={e => setProjectSearch(e.target.value)}
                  className={inputCls + " mb-3"} />
              )}

              {/* Lista proyectos */}
              {proyectos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 border border-border/60 rounded-xl">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "oklch(0.52 0.13 165 / 0.10)" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="oklch(0.52 0.13 165)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                    </svg>
                  </div>
                  <p className="text-[13px] font-medium text-muted-foreground">{grupo.proyectos?.length > 0 ? "Sin coincidencias." : "Sin proyectos aún."}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {proyectos.map((p, i) => {
                    const stateHue = STATE_COLOR[p.estado] || "260"
                    const av = p.avance ?? 0
                    return (
                      <div key={i} className="border border-border rounded-xl p-4 relative"
                        style={{ borderLeft: `3px solid oklch(0.62 0.18 ${stateHue})` }}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-foreground text-[14px]">{p.nombre}</span>
                              {p.estado && (
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                                  style={{ background: `oklch(0.62 0.18 ${stateHue} / 0.13)`, color: `oklch(0.52 0.20 ${stateHue})` }}>
                                  {p.estado}
                                </span>
                              )}
                              {p.area && (
                                <span className="text-[11px] text-muted-foreground px-2 py-0.5 rounded-full bg-muted">{p.area}</span>
                              )}
                            </div>
                          </div>
                          {(isAdmin || isMember) && (
                            <div className="flex gap-2 flex-shrink-0 items-center">
                              {isAdmin && (
                                <button
                                  onClick={() => handleReturnProject(p)}
                                  title="Devolver al perfil individual"
                                  className="text-[11px] font-medium px-2 py-0.5 rounded-md transition-colors"
                                  style={{ color: "oklch(0.55 0.16 145)", background: "oklch(0.55 0.16 145 / 0.10)" }}>
                                  ← Individual
                                </button>
                              )}
                              <button onClick={() => openEditProject(p)} className="text-muted-foreground hover:text-foreground transition-colors">
                                <Pencil size={13} />
                              </button>
                              {isAdmin && (
                                <button onClick={() => handleDeleteProject(p)} className="text-destructive/60 hover:text-destructive transition-colors">
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        {/* Avance */}
                        <div className="mb-2">
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-muted-foreground">Avance</span>
                            <span style={{ color: avanceColor(av) }} className="font-semibold">{av}%</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(0.40 0.02 260 / 0.3)" }}>
                            <div className="h-full rounded-full" style={{ width: `${av}%`, background: avanceColor(av) }} />
                          </div>
                        </div>
                        {p.queHace && <p className="text-[12.5px] text-muted-foreground mb-2 leading-relaxed">{p.queHace}</p>}
                        {p.herramientas?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {p.herramientas.map(h => (
                              <span key={h} className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground">{h}</span>
                            ))}
                          </div>
                        )}
                        {(p.fechaInicio || p.fechaEntrega) && (
                          <div className="flex gap-4 text-[11px] text-muted-foreground">
                            {p.fechaInicio && <span>Inicio: <strong>{p.fechaInicio}</strong></span>}
                            {p.fechaEntrega && <span>Entrega: <strong>{p.fechaEntrega}</strong></span>}
                          </div>
                        )}
                        {p.observaciones && (
                          <p className="text-[12px] text-muted-foreground mt-2 italic">{p.observaciones}</p>
                        )}

                        {/* ── Archivos del proyecto ── */}
                        {canAccess && (() => {
                          const proyDocs = groupDocuments.filter(d => d.proyectoNombre === p.nombre)
                          const isOpen = openDocProjects.has(p.nombre)
                          const isUploading = uploadingForProject === p.nombre && uploadProgress !== null
                          return (
                            <div className="mt-3 pt-3 border-t border-border">
                              <div className="flex items-center justify-between">
                                <button
                                  onClick={() => setOpenDocProjects(prev => {
                                    const s = new Set(prev)
                                    s.has(p.nombre) ? s.delete(p.nombre) : s.add(p.nombre)
                                    return s
                                  })}
                                  className="flex items-center gap-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
                                  <span>Archivos</span>
                                  {proyDocs.length > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                                      style={{ backgroundColor: `oklch(0.62 0.18 ${hue} / 0.15)`, color: `oklch(0.52 0.20 ${hue})` }}>
                                      {proyDocs.length}
                                    </span>
                                  )}
                                  <span className="text-[10px] opacity-50">{isOpen ? "▲" : "▼"}</span>
                                </button>
                                <button
                                  onClick={() => { uploadingProjectRef.current = p.nombre; setUploadingForProject(p.nombre); fileInputRef.current?.click() }}
                                  disabled={uploadProgress !== null}
                                  className="text-[11px] font-semibold px-3 py-1 rounded-lg text-white disabled:opacity-50 transition-all hover:opacity-90"
                                  style={{ background: `oklch(0.52 0.22 ${hue})` }}>
                                  {isUploading ? `${uploadProgress}%` : "↑ Subir"}
                                </button>
                              </div>
                              {isUploading && (
                                <div className="h-1 rounded-full bg-muted overflow-hidden mt-2">
                                  <div className="h-full rounded-full transition-all duration-200"
                                    style={{ width: `${uploadProgress}%`, background: `oklch(0.52 0.22 ${hue})` }} />
                                </div>
                              )}
                              {uploadingForProject === p.nombre && uploadError && (
                                <p className="text-[11px] text-destructive mt-1">{uploadError}</p>
                              )}
                              {isOpen && (
                                <div className="mt-2 space-y-1.5">
                                  {proyDocs.length === 0 ? (
                                    <p className="text-[11px] text-muted-foreground italic">Sin archivos aún.</p>
                                  ) : proyDocs.map(d => {
                                    const fi = getFileTypeInfo(d.tipo, d.nombre)
                                    return (
                                      <div key={d.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border/60 bg-muted/30">
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                                          style={{ color: fi.color, backgroundColor: fi.bg }}>{fi.label}</span>
                                        <span className="flex-1 text-[11px] text-foreground truncate">{d.nombre}</span>
                                        {d.size && <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatFileSize(d.size)}</span>}
                                        <button type="button" onClick={() => downloadFile(d.url, d.nombre)}
                                          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0" title="Descargar">↓</button>
                                        {isAdmin && (
                                          <button onClick={() => handleDeleteGroupDoc(d)}
                                            className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">×</button>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </section>

        {/* ══ BITÁCORA ════════════════════════════════════════════════════════ */}
        <section className="bg-card border border-border rounded-2xl p-5">
          <div className={sectionHeaderCls} onClick={() => toggleSection("bitacora")}>
            <div className="flex items-center gap-3">
              <h2 className="text-[16px] font-bold text-foreground">Bitácora</h2>
              <span className="text-[12px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{logs.length}</span>
            </div>
            {openSections.bitacora ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
          </div>

          {openSections.bitacora && (
            <>
              {/* Entrada */}
              {canLog && (
                <div className="mb-4 relative">
                  <textarea
                    ref={notaRef}
                    placeholder="Escribe una nota del grupo…"
                    value={nota}
                    onChange={e => setNota(e.target.value)}
                    rows={3}
                    className={inputCls + " resize-none pr-10"}
                  />
                  <button className="absolute right-3 bottom-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowEmoji(v => !v)}>😊</button>
                  {showEmoji && (
                    <div className="absolute right-0 top-full mt-1 z-50">
                      <EmojiPicker onEmojiClick={e => { setNota(n => n + e.emoji); setShowEmoji(false); notaRef.current?.focus() }} height={350} width={300} />
                    </div>
                  )}
                  <Button size="sm" className="mt-2" onClick={handleAddLog} disabled={savingLog || !nota.trim()}>
                    {savingLog ? "Guardando…" : "Agregar nota"}
                  </Button>
                </div>
              )}

              {/* Lista */}
              {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 border border-border/60 rounded-xl">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "oklch(0.52 0.13 165 / 0.10)" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="oklch(0.52 0.13 165)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/>
                    </svg>
                  </div>
                  <p className="text-[13px] font-medium text-muted-foreground">Sin notas aún.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map(l => {
                    const canEditLog = isAdmin || l.creadoPor === user?.uid
                    return (
                      <div key={l.id} className="border border-border/60 rounded-xl p-4">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1">
                            {editingLogId === l.id ? (
                              <div className="space-y-2">
                                <textarea value={editingLogText} onChange={e => setEditingLogText(e.target.value)}
                                  rows={3} className={inputCls + " resize-none"} />
                                <div className="flex gap-2">
                                  <button onClick={() => handleSaveEditLog(l.id)}
                                    className="text-[12px] text-primary flex items-center gap-1 hover:opacity-80"><Check size={12} /> Guardar</button>
                                  <button onClick={() => setEditingLogId(null)}
                                    className="text-[12px] text-muted-foreground flex items-center gap-1 hover:text-foreground"><X size={12} /> Cancelar</button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-[13px] text-foreground leading-relaxed whitespace-pre-wrap">{l.nota}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[11px] text-muted-foreground font-medium">{l.creadoPorNombre}</span>
                              {l.createdAt?.toDate && (
                                <span className="text-[11px] text-muted-foreground capitalize">
                                  · {format(l.createdAt.toDate(), "d 'de' MMM 'a las' HH:mm", { locale: es })}
                                </span>
                              )}
                            </div>
                          </div>
                          {canEditLog && editingLogId !== l.id && (
                            <div className="flex gap-2 flex-shrink-0">
                              <button onClick={() => { setEditingLogId(l.id); setEditingLogText(l.nota) }}
                                className="text-muted-foreground hover:text-foreground transition-colors"><Pencil size={13} /></button>
                              <button onClick={() => handleDeleteLog(l.id)}
                                className="text-destructive/60 hover:text-destructive transition-colors"><Trash2 size={13} /></button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </section>

        {/* ══ TAREAS ══════════════════════════════════════════════════════════ */}
        <section className="bg-card border border-border rounded-2xl p-5">
          <div className={sectionHeaderCls} onClick={() => toggleSection("tareas")}>
            <div className="flex items-center gap-3">
              <h2 className="text-[16px] font-bold text-foreground">Tareas</h2>
              {tareasPendientes.length > 0 && (
                <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "oklch(0.62 0.22 27 / 0.15)", color: "oklch(0.52 0.22 27)" }}>
                  {tareasPendientes.length} pendiente{tareasPendientes.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && openSections.tareas && (
                <button onClick={e => { e.stopPropagation(); setShowTaskForm(v => !v) }}
                  className="flex items-center gap-1 text-[12px] font-medium px-3 py-1 rounded-lg"
                  style={{ background: `oklch(0.62 0.22 ${hue} / 0.12)`, color: `oklch(0.52 0.22 ${hue})` }}>
                  <Plus size={12} /> Tarea
                </button>
              )}
              {openSections.tareas ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
            </div>
          </div>

          {openSections.tareas && (
            <>
              {showTaskForm && isAdmin && (
                <div className="bg-muted/40 border border-border rounded-xl p-4 mb-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <p className={labelCls}>Título *</p>
                      <input placeholder="Título de la tarea" value={taskForm.titulo}
                        onChange={e => setTaskForm(f => ({ ...f, titulo: e.target.value }))} className={inputCls} />
                    </div>
                    <div className="sm:col-span-2">
                      <p className={labelCls}>Descripción</p>
                      <input placeholder="Descripción (opcional)" value={taskForm.descripcion}
                        onChange={e => setTaskForm(f => ({ ...f, descripcion: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <p className={labelCls}>Fecha inicio</p>
                      <input type="date" value={taskForm.fechaInicio}
                        onChange={e => setTaskForm(f => ({ ...f, fechaInicio: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <p className={labelCls}>Fecha límite</p>
                      <input type="date" value={taskForm.fechaLimite}
                        onChange={e => setTaskForm(f => ({ ...f, fechaLimite: e.target.value }))} className={inputCls} />
                    </div>
                    <div className="sm:col-span-2">
                      <p className={labelCls}>Avance inicial: {taskForm.avance}%</p>
                      <input type="range" min="0" max="100" step="5" value={taskForm.avance}
                        onChange={e => setTaskForm(f => ({ ...f, avance: Number(e.target.value) }))}
                        className="w-full accent-primary" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddTask} disabled={savingTask}>
                      {savingTask ? "Guardando…" : "Crear tarea"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowTaskForm(false)}>Cancelar</Button>
                  </div>
                </div>
              )}

              {tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 border border-border/60 rounded-xl">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "oklch(0.52 0.13 165 / 0.10)" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="oklch(0.52 0.13 165)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9,11 12,14 22,4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                  </div>
                  <p className="text-[13px] font-medium text-muted-foreground">Sin tareas aún.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {[...tareasPendientes, ...tareasHechas].map(t => {
                    const done = t.estado === "Hecho"
                    return (
                      <div key={t.id} className="p-3 rounded-xl border border-border/60 group">
                        {editingTaskId === t.id ? (
                          <div className="space-y-3">
                            <input value={editingTaskForm.titulo}
                              onChange={e => setEditingTaskForm(f => ({ ...f, titulo: e.target.value }))}
                              placeholder="Título *" className={inputCls} />
                            <input value={editingTaskForm.descripcion}
                              onChange={e => setEditingTaskForm(f => ({ ...f, descripcion: e.target.value }))}
                              placeholder="Descripción (opcional)" className={inputCls} />
                            <div className="flex gap-3">
                              <div className="flex-1">
                                <p className={labelCls}>Fecha inicio</p>
                                <input type="date" value={editingTaskForm.fechaInicio || ""}
                                  onChange={e => setEditingTaskForm(f => ({ ...f, fechaInicio: e.target.value }))} className={inputCls} />
                              </div>
                              <div className="flex-1">
                                <p className={labelCls}>Fecha límite</p>
                                <input type="date" value={editingTaskForm.fechaLimite || ""}
                                  onChange={e => setEditingTaskForm(f => ({ ...f, fechaLimite: e.target.value }))} className={inputCls} />
                              </div>
                            </div>
                            <div>
                              <p className={labelCls}>Avance: {editingTaskForm.avance ?? 0}%</p>
                              <input type="range" min="0" max="100" step="5" value={editingTaskForm.avance ?? 0}
                                onChange={e => setEditingTaskForm(f => ({ ...f, avance: Number(e.target.value) }))}
                                className="w-full accent-primary" />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleSaveEditTask(t)}>Guardar</Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingTaskId(null)}>Cancelar</Button>
                            </div>
                            {t.plazoAceptado && (
                              <div className= "px-3 py-2 rounded-lg"
                                style={{ background: "oklch(0.62 0.20 145 / 0.12)", border: "1px solid oklch(0.62 0.20 145 / 0.35)" }}>
                                <p className="text-[11px] font-bold" style={{ color: "oklch(0.62 0.20 145)" }}>✓ Solicitud de tiempo aceptada</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  Nueva fecha límite: {format(new Date(t.plazoAceptado.nuevaFecha + "T00:00:00"), "d 'de' MMMM, yyyy", { locale: es })}
                                </p>
                              </div>
                            )}
                            {t.plazoRechazado && (
                              <div className="px-3 py-2 rounded-lg"
                                style={{ background: "oklch(0.62 0.22 25 / 0.12)", border: "1px solid oklch(0.62 0.22 25 / 0.35)" }}>
                                <p className="text-[11px] font-bold" style={{ color: "oklch(0.62 0.22 25)" }}>✗ Solicitud de tiempo rechazada</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-start gap-3">
                            <button onClick={() => handleTaskStatus(t.id, done ? "Pendiente" : "Hecho")}
                              className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                              style={{ borderColor: done ? "oklch(0.55 0.18 145)" : "var(--border)", backgroundColor: done ? "oklch(0.55 0.18 145)" : "transparent" }}>
                              {done && <Check size={10} className="text-white" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className={`text-[13px] font-medium leading-tight ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                {t.titulo}
                              </p>
                              {t.descripcion && <p className="text-[11px] text-muted-foreground mt-0.5">{t.descripcion}</p>}
                              {/* Avance — slider para miembros no-admin, barra para el resto */}
                              {isMember && !isAdmin && !done ? (
                                <div className="mt-1.5">
                                  <div className="flex justify-between text-[10px] mb-1">
                                    <span className="text-muted-foreground font-medium">Avance</span>
                                    <span className="font-bold tabular-nums" style={{ color: (taskAvanceLocal[t.id] ?? t.avance ?? 0) >= 100 ? "oklch(0.55 0.18 145)" : (taskAvanceLocal[t.id] ?? t.avance ?? 0) >= 50 ? "oklch(0.55 0.18 260)" : "oklch(0.60 0.18 55)" }}>
                                      {taskAvanceLocal[t.id] ?? t.avance ?? 0}%
                                    </span>
                                  </div>
                                  <input type="range" min="0" max="100" step="5"
                                    value={taskAvanceLocal[t.id] ?? t.avance ?? 0}
                                    onChange={e => setTaskAvanceLocal(prev => ({ ...prev, [t.id]: Number(e.target.value) }))}
                                    disabled={savingAvance === t.id}
                                    className="w-full accent-primary disabled:opacity-50" />
                                  {taskAvanceLocal[t.id] != null && taskAvanceLocal[t.id] !== (t.avance ?? 0) && (
                                    <div className="flex items-center gap-2 mt-1">
                                      <button onClick={() => handleUpdateAvance(t.id, taskAvanceLocal[t.id])}
                                        disabled={savingAvance === t.id}
                                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg text-white disabled:opacity-50"
                                        style={{ background: `oklch(0.52 0.22 ${hue})` }}>
                                        {savingAvance === t.id ? "Guardando…" : "Guardar avance"}
                                      </button>
                                      <button onClick={() => setTaskAvanceLocal(prev => { const n = { ...prev }; delete n[t.id]; return n })}
                                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                                        Descartar
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (t.avance != null && t.avance > 0) && (
                                <div className="mt-1.5">
                                  <div className="flex justify-between text-[10px] mb-0.5">
                                    <span className="text-muted-foreground">Avance</span>
                                    <span className="font-semibold" style={{ color: t.avance >= 100 ? "oklch(0.55 0.18 145)" : t.avance >= 50 ? "oklch(0.55 0.18 260)" : "oklch(0.60 0.18 55)" }}>
                                      {t.avance}%
                                    </span>
                                  </div>
                                  <div className="h-1.5 rounded-full overflow-hidden bg-muted">
                                    <div className="h-full rounded-full" style={{ width: `${t.avance}%`, background: t.avance >= 100 ? "oklch(0.55 0.18 145)" : t.avance >= 50 ? "oklch(0.55 0.18 260)" : "oklch(0.60 0.18 55)" }} />
                                  </div>
                                </div>
                              )}
                              <div className="flex gap-3 mt-0.5 flex-wrap">
                                {t.fechaInicio && <p className="text-[11px] text-muted-foreground">Inicio: {t.fechaInicio}</p>}
                                {t.fechaLimite && <p className="text-[11px] text-muted-foreground">Límite: {t.fechaLimite}</p>}
                              </div>

                              {/* Solicitud de plazo — admin ve el aviso */}
                              {t.solicitudPlazo && isAdmin && (
                                <div className="mt-2 px-3 py-2 rounded-lg"
                                  style={{ background: "oklch(0.68 0.18 55 / 0.10)", border: "1px solid oklch(0.68 0.18 55 / 0.30)" }}>
                                  <p className="text-[11px] font-bold" style={{ color: "oklch(0.58 0.20 55)" }}>
                                    ⏰ Solicitud de más tiempo · {t.solicitudPlazo.solicitadoPor}
                                  </p>
                                  <p className="text-[12px] text-foreground mt-0.5">{t.solicitudPlazo.motivo}</p>
                                  {t.solicitudPlazo.fechaPropuesta && (
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                      Fecha propuesta: {format(new Date(t.solicitudPlazo.fechaPropuesta + "T00:00:00"), "d 'de' MMMM, yyyy", { locale: es })}
                                    </p>
                                  )}
                                  {aceptandoPlazoId === t.id ? (
                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                      <input type="date" value={fechaAceptar} onChange={e => setFechaAceptar(e.target.value)}
                                        className="bg-background border border-border rounded-lg px-2 py-1 text-[11px] text-foreground focus:outline-none" />
                                      <button onClick={() => handleAceptarPlazo(t)} disabled={!fechaAceptar || savingPlazo}
                                        className="h-6 px-2 rounded-lg text-[11px] font-bold text-white disabled:opacity-50"
                                        style={{ background: "oklch(0.55 0.18 145)" }}>
                                        {savingPlazo ? "…" : "Confirmar"}
                                      </button>
                                      <button onClick={() => { setAceptandoPlazoId(null); setFechaAceptar("") }}
                                        className="h-6 px-2 rounded-lg text-[11px] border border-border text-muted-foreground hover:text-foreground">
                                        Cancelar
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex gap-2 mt-2">
                                      <button onClick={() => handleAceptarPlazo(t)} disabled={savingPlazo}
                                        className="h-6 px-2 rounded-lg text-[11px] font-bold text-white disabled:opacity-50"
                                        style={{ background: "oklch(0.55 0.18 145)" }}>
                                        {savingPlazo ? "…" : "✓ Aceptar"}
                                      </button>
                                      <button onClick={() => handleRechazarPlazo(t.id)} disabled={savingPlazo}
                                        className="h-6 px-2 rounded-lg text-[11px] font-bold text-white disabled:opacity-50"
                                        style={{ background: "oklch(0.50 0.22 25)" }}>
                                        {savingPlazo ? "…" : "✗ Rechazar"}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Confirmación para el miembro que ya solicitó */}
                              {t.solicitudPlazo && isMember && editandoSolicitudId !== t.id && (
                                <div className="mt-1.5 px-3 py-2 rounded-lg"
                                  style={{ background: "oklch(0.68 0.18 55 / 0.10)", border: "1px solid oklch(0.68 0.18 55 / 0.30)" }}>
                                  <p className="text-[11px] font-bold" style={{ color: "oklch(0.58 0.20 55)" }}>⏰ Solicitud enviada</p>
                                  <p className="text-[12px] text-foreground mt-0.5">{t.solicitudPlazo.motivo}</p>
                                  {t.solicitudPlazo.fechaPropuesta && (
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                      Fecha propuesta: {format(new Date(t.solicitudPlazo.fechaPropuesta + "T00:00:00"), "d 'de' MMMM, yyyy", { locale: es })}
                                    </p>
                                  )}
                                  <button onClick={() => { setEditandoSolicitudId(t.id); setSolicitudMotivo(t.solicitudPlazo.motivo || ""); setSolicitudFecha(t.solicitudPlazo.fechaPropuesta || ""); setSolicitudPlazoId(t.id) }}
                                    className="text-[11px] font-medium mt-1 hover:opacity-70 transition-opacity" style={{ color: "oklch(0.58 0.20 55)" }}>
                                    ✏ Editar solicitud
                                  </button>
                                </div>
                              )}

                              {/* Resultado de solicitud de plazo */}
                              {t.plazoAceptado && (
                                <div className="mt-2 px-3 py-2 rounded-lg"
                                  style={{ background: "oklch(0.62 0.20 145 / 0.12)", border: "1px solid oklch(0.62 0.20 145 / 0.35)" }}>
                                  <p className="text-[11px] font-bold" style={{ color: "oklch(0.62 0.20 145)" }}>✓ Solicitud de tiempo aceptada</p>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    Nueva fecha límite: {format(new Date(t.plazoAceptado.nuevaFecha + "T00:00:00"), "d 'de' MMMM, yyyy", { locale: es })}
                                  </p>
                                </div>
                              )}
                              {t.plazoRechazado && (
                                <div className="mt-2 px-3 py-2 rounded-lg"
                                  style={{ background: "oklch(0.62 0.22 25 / 0.12)", border: "1px solid oklch(0.62 0.22 25 / 0.35)" }}>
                                  <p className="text-[11px] font-bold" style={{ color: "oklch(0.62 0.22 25)" }}>✗ Solicitud de tiempo rechazada</p>
                                </div>
                              )}

                              {/* Archivos adjuntos de la tarea */}
                              {canAccess && (
                                <div className="mt-2 pt-2 border-t border-border">
                                  <div className="flex items-center justify-between">
                                    <button
                                      onClick={() => setOpenTaskFiles(prev => { const s = new Set(prev); s.has(t.id) ? s.delete(t.id) : s.add(t.id); return s })}
                                      className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
                                      <span>Archivos</span>
                                      {(t.archivos?.length > 0) && (
                                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                                          style={{ background: `oklch(0.62 0.22 ${hue} / 0.15)`, color: `oklch(0.52 0.22 ${hue})` }}>
                                          {t.archivos.length}
                                        </span>
                                      )}
                                      <span className="text-[9px] opacity-40">{openTaskFiles.has(t.id) ? "▲" : "▼"}</span>
                                    </button>
                                    <button
                                      onClick={() => { uploadingTaskIdRef.current = t.id; taskFileInputRef.current?.click() }}
                                      disabled={taskFileProgress !== null}
                                      className="text-[10px] font-bold px-2.5 py-1 rounded-lg text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                                      style={{ background: `oklch(0.52 0.22 ${hue})` }}>
                                      {taskFileProgress?.taskId === t.id ? `${taskFileProgress.progress}%` : "↑ Subir"}
                                    </button>
                                  </div>
                                  {taskFileProgress?.taskId === t.id && (
                                    <div className="h-1 rounded-full bg-muted overflow-hidden mt-1.5">
                                      <div className="h-full rounded-full transition-all"
                                        style={{ width: `${taskFileProgress.progress}%`, background: `oklch(0.52 0.22 ${hue})` }} />
                                    </div>
                                  )}
                                  {openTaskFiles.has(t.id) && (
                                    <div className="mt-1.5 space-y-1">
                                      {!t.archivos?.length ? (
                                        <p className="text-[10px] text-muted-foreground italic py-1">Sin archivos adjuntos.</p>
                                      ) : t.archivos.map((arch, ai) => {
                                        const fi = getFileTypeInfo(arch.tipo, arch.nombre)
                                        return (
                                          <div key={ai} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded flex-shrink-0"
                                              style={{ background: fi.bg, color: fi.color }}>{fi.label}</span>
                                            <span className="text-[11px] text-foreground truncate flex-1 min-w-0">{arch.nombre}</span>
                                            {arch.size && <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatFileSize(arch.size)}</span>}
                                            <button type="button" onClick={() => downloadFile(arch.url, arch.nombre)}
                                              className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0" title="Descargar">↓</button>
                                            {(isAdmin || isMember) && (
                                              <button onClick={() => handleDeleteGroupTaskFile(t.id, arch)}
                                                className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">✕</button>
                                            )}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Botón / formulario para pedir plazo */}
                              {isMember && !done && !t.plazoAceptado && !t.plazoRechazado && (!t.solicitudPlazo || editandoSolicitudId === t.id) && (
                                solicitudPlazoId === t.id ? (
                                  <div className="mt-2 space-y-2">
                                    <textarea
                                      value={solicitudMotivo}
                                      onChange={e => setSolicitudMotivo(e.target.value)}
                                      placeholder="¿Por qué necesitas más tiempo?"
                                      rows={2}
                                      className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 resize-none"
                                    />
                                    <div className="flex flex-wrap gap-2 items-center">
                                      <input type="date" value={solicitudFecha}
                                        onChange={e => setSolicitudFecha(e.target.value)}
                                        className="bg-muted/50 border border-border rounded-xl px-3 py-1.5 text-[12px] text-foreground focus:outline-none" />
                                      <span className="text-[11px] text-muted-foreground">fecha propuesta (opcional)</span>
                                    </div>
                                    <div className="flex gap-2">
                                      <button onClick={() => { handleSolicitarPlazo(t.id); setEditandoSolicitudId(null) }}
                                        disabled={savingSolicitud || !solicitudMotivo.trim()}
                                        className="h-7 px-3 rounded-lg text-[11px] font-bold text-white disabled:opacity-50"
                                        style={{ background: "oklch(0.58 0.20 55)" }}>
                                        {savingSolicitud ? "Enviando…" : "Enviar solicitud"}
                                      </button>
                                      <button onClick={() => { setSolicitudPlazoId(null); setSolicitudMotivo(""); setSolicitudFecha(""); setEditandoSolicitudId(null) }}
                                        className="h-7 px-3 rounded-lg text-[11px] border border-border text-muted-foreground hover:text-foreground">
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button onClick={() => { setSolicitudPlazoId(t.id); setSolicitudMotivo(""); setSolicitudFecha("") }}
                                    className="mt-1.5 text-[11px] font-medium hover:opacity-70 transition-opacity"
                                    style={{ color: "oklch(0.58 0.20 55)" }}>
                                    ⏳ Solicitar más tiempo
                                  </button>
                                )
                              )}
                            </div>
                            {isAdmin && (
                              <div className="flex gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { setEditingTaskId(t.id); setEditingTaskForm({ titulo: t.titulo, descripcion: t.descripcion || "", fechaInicio: t.fechaInicio || "", fechaLimite: t.fechaLimite || "", avance: t.avance ?? 0 }) }}
                                  className="text-muted-foreground hover:text-foreground transition-colors"><Pencil size={13} /></button>
                                <button onClick={() => handleDeleteTask(t.id)}
                                  className="text-destructive/60 hover:text-destructive transition-colors"><Trash2 size={13} /></button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </section>

        {/* ══ RETROALIMENTACIÓN (admin escribe, grupo lee) ══════════════════ */}
        <section className="bg-card border border-border rounded-2xl p-5">
          <div className={sectionHeaderCls} onClick={() => toggleSection("feedback")}>
            <div className="flex items-center gap-3">
              <h2 className="text-[16px] font-bold text-foreground">Retroalimentación</h2>
              <span className="text-[12px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{feedback.length}</span>
            </div>
            {openSections.feedback ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
          </div>

          {openSections.feedback && (
            <>
              {isAdmin && (
                <div className="mb-4">
                  <textarea placeholder="Escribe retroalimentación para el grupo…"
                    value={feedbackText} onChange={e => setFeedbackText(e.target.value)}
                    rows={3} className={inputCls + " resize-none"} />
                  <Button size="sm" className="mt-2" onClick={handleAddFeedback} disabled={savingFeedback || !feedbackText.trim()}>
                    {savingFeedback ? "Guardando…" : "Enviar"}
                  </Button>
                </div>
              )}

              {feedback.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 border border-border/60 rounded-xl">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "oklch(0.75 0.15 80 / 0.12)" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="oklch(0.65 0.16 75)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  <p className="text-[13px] font-medium text-muted-foreground">Sin retroalimentación aún.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {feedback.map(f => (
                    <div key={f.id} className="border border-border/60 rounded-xl p-4">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          {editingFbId === f.id ? (
                            <div className="space-y-2">
                              <textarea value={editingFbText} onChange={e => setEditingFbText(e.target.value)}
                                rows={3} className={inputCls + " resize-none"} />
                              <div className="flex gap-2">
                                <button onClick={() => handleSaveEditFeedback(f.id)}
                                  className="text-[12px] text-primary flex items-center gap-1"><Check size={12} /> Guardar</button>
                                <button onClick={() => setEditingFbId(null)}
                                  className="text-[12px] text-muted-foreground flex items-center gap-1"><X size={12} /> Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[13px] text-foreground leading-relaxed whitespace-pre-wrap">{f.texto}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[11px] text-muted-foreground font-medium">{f.creadoPorNombre}</span>
                            {f.createdAt?.toDate && (
                              <span className="text-[11px] text-muted-foreground capitalize">
                                · {format(f.createdAt.toDate(), "d 'de' MMM 'a las' HH:mm", { locale: es })}
                              </span>
                            )}
                          </div>
                        </div>
                        {isAdmin && editingFbId !== f.id && (
                          <div className="flex gap-2 flex-shrink-0">
                            <button onClick={() => { setEditingFbId(f.id); setEditingFbText(f.texto) }}
                              className="text-muted-foreground hover:text-foreground transition-colors"><Pencil size={13} /></button>
                            <button onClick={() => handleDeleteFeedback(f.id)}
                              className="text-destructive/60 hover:text-destructive transition-colors"><Trash2 size={13} /></button>
                          </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

        {/* ── Sección: Participantes importados ── */}
        {(isAdmin || isMember) && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <button onClick={() => toggleSection("contactos")}
                className="flex items-center gap-2 group">
                <h2 className="text-[18px] font-bold text-foreground tracking-tight">Participantes</h2>
                {contacts.length > 0 && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "oklch(0.60 0.18 260 / 0.12)", color: "oklch(0.55 0.18 260)" }}>
                    {contacts.length}
                  </span>
                )}
                {openSections.contactos ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
              </button>
              <div className="flex gap-2">
                {contacts.length > 0 && (
                  <button onClick={handleDeleteAllContacts}
                    className="text-[11px] font-semibold text-destructive/70 hover:text-destructive transition-colors">
                    Limpiar todo
                  </button>
                )}
                <button
                  onClick={() => contactsInputRef.current?.click()}
                  disabled={importLoading}
                  className="text-[12px] font-semibold px-4 py-1.5 rounded-xl border border-border text-foreground hover:border-primary/40 hover:bg-muted/60 disabled:opacity-50 transition-all">
                  {importLoading ? "Leyendo…" : "↑ Importar Excel / CSV"}
                </button>
              </div>
            </div>

            {importError && (
              <p className="text-[12px] text-destructive">{importError}</p>
            )}

            {/* Preview antes de confirmar */}
            {importPreview && (
              <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-foreground">
                    Se importarán <span style={{ color: "oklch(0.55 0.18 145)" }}>{importPreview.length} contactos</span>
                  </p>
                  <button onClick={() => setImportPreview(null)}
                    className="text-[11px] text-muted-foreground hover:text-foreground">✕ Cancelar</button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Nombre</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Teléfono</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Correo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.slice(0, 5).map((c, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                          <td className="px-3 py-2 text-foreground">{c.nombre || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{c.telefono || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{c.correo || "—"}</td>
                        </tr>
                      ))}
                      {importPreview.length > 5 && (
                        <tr><td colSpan={3} className="px-3 py-2 text-muted-foreground italic text-center">
                          …y {importPreview.length - 5} más
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <button onClick={handleConfirmImport} disabled={importSaving}
                  className="text-[13px] font-bold px-5 py-2 rounded-xl text-white disabled:opacity-50 transition-all hover:opacity-90"
                  style={{ background: "oklch(0.55 0.18 145)" }}>
                  {importSaving ? "Guardando…" : `Confirmar importación (${importPreview.length})`}
                </button>
              </div>
            )}

            {/* Lista de contactos */}
            {openSections.contactos && contacts.length > 0 && (
              <>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <input type="text" placeholder="Buscar participante…" value={contactSearch}
                    onChange={e => setContactSearch(e.target.value)}
                    className="w-full h-9 bg-card border border-border rounded-xl pl-8 pr-4 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all" />
                </div>
                <div className="overflow-x-auto rounded-2xl border border-border">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-border bg-card">
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Nombre</th>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Teléfono / WhatsApp</th>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Correo</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {contacts
                        .filter(c => {
                          const q = contactSearch.toLowerCase()
                          return !q || c.nombre?.toLowerCase().includes(q) || c.correo?.toLowerCase().includes(q) || c.telefono?.includes(q)
                        })
                        .map(c => (
                          <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors group">
                            <td className="px-4 py-2.5 font-medium text-foreground">{c.nombre || "—"}</td>
                            <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{c.telefono || "—"}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">{c.correo || "—"}</td>
                            <td className="px-4 py-2.5 text-right">
                              <button onClick={() => handleDeleteContact(c.id)}
                                className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100">✕</button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {openSections.contactos && contacts.length === 0 && !importPreview && (
              <div className="text-center py-10 text-muted-foreground bg-card border border-border rounded-2xl">
                <p className="text-[13px]">Sin participantes importados. Sube un Excel o CSV con columnas: Nombre, Teléfono, Correo.</p>
              </div>
            )}
          </section>
        )}

      </main>
      <Footer />

      {/* Modal: devolver proyecto a perfil individual */}
      {returningProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "oklch(0 0 0 / 0.55)", backdropFilter: "blur(4px)" }}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-[15px] font-bold text-foreground mb-1">Devolver al perfil individual</h3>
            <p className="text-[12px] text-muted-foreground mb-4">
              Selecciona a qué compañera pertenece el proyecto <strong>"{returningProject.nombre}"</strong>.
              Se añadirá a su perfil y se quitará del grupo.
            </p>
            <select
              value={returnTargetId || miembros[0]?.id || ""}
              onChange={e => setReturnTargetId(e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 mb-4">
              {miembros.map(m => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleConfirmReturn}
                disabled={savingReturn || !returnTargetId}
                className="flex-1 py-2 rounded-xl text-[13px] font-bold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ background: "oklch(0.55 0.18 145)" }}>
                {savingReturn ? "Devolviendo…" : "Confirmar"}
              </button>
              <button
                onClick={() => setReturningProject(null)}
                className="flex-1 py-2 rounded-xl text-[13px] border border-border text-muted-foreground hover:text-foreground transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input oculto para importar participantes */}
      <input ref={contactsInputRef} type="file" accept=".csv,.xls,.xlsx"
        style={{ display: "none" }} onChange={handleContactsFileSelected} />
      {/* Input oculto para documentos de proyectos */}
      <input ref={fileInputRef} type="file"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
        style={{ display: "none" }} onChange={handleFileSelected} />
      {/* Input oculto para archivos de tareas */}
      <input ref={taskFileInputRef} type="file"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
        style={{ display: "none" }} onChange={handleGroupTaskFileSelected} />
    </div>
  )
}
