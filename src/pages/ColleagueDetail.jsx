import { useEffect, useState, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/services/firebase"
import { deleteColleague, deleteProject } from "@/services/colleagues.service"
import { getGrupos, addGrupoProject } from "@/services/groups.service"
import { addLog, getLogs, deleteLog, updateLog } from "@/services/logs.service"
import { addFeedback, getFeedback, deleteFeedback, updateFeedback } from "@/services/feedback.service"
import { addTask, getTasks, updateTask, updateTaskStatus, deleteTask, updateTaskAvance, addTaskFile, removeTaskFile, solicitarPlazoTask, cancelarPlazoTask } from "@/services/tasks.service"
import { notificarTareaCompletada, crearNotificacionUsuario } from "@/services/notificaciones.service"
import { queueTareaNotification } from "@/services/wpp.service"
import { uploadDocument, getDocuments, deleteDocument, uploadTaskFile, deleteTaskFile, MAX_FILE_SIZE } from "@/services/storage.service"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import EmojiPicker from "emoji-picker-react"
import { Footer } from "@/components/ui/Footer"

const ADMIN_EMAILS = ["andrea_ramirezt@cun.edu.co", "angela_bernalm@cun.edu.co", "jose_forero@cun.edu.co"]

function hashHue(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return Math.abs(h * 137.508) % 360
}

function parseLocalDate(str) {
  if (!str) return null
  const [y, m, d] = str.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function deadlineStatus(fechaEntrega) {
  const deadline = parseLocalDate(fechaEntrega)
  if (!deadline) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.ceil((deadline - today) / 86400000)
  if (diff < 0)  return { label: "Vencido",      color: "oklch(0.65 0.22 27)",  bg: "oklch(0.65 0.22 27 / 0.12)"  }
  if (diff === 0) return { label: "Vence hoy",    color: "oklch(0.70 0.20 55)",  bg: "oklch(0.70 0.20 55 / 0.12)"  }
  if (diff <= 7)  return { label: `${diff}d`,     color: "oklch(0.70 0.18 60)",  bg: "oklch(0.70 0.18 60 / 0.12)"  }
  return            { label: `${diff}d restantes`, color: "oklch(0.60 0.18 145)", bg: "oklch(0.60 0.18 145 / 0.12)" }
}

const PROJECT_STATE_STYLE = {
  "Planificación": { color: "oklch(0.62 0.18 260)", bg: "oklch(0.62 0.18 260 / 0.12)" },
  "En desarrollo": { color: "oklch(0.60 0.18 290)", bg: "oklch(0.60 0.18 290 / 0.12)" },
  "En revisión":   { color: "oklch(0.68 0.18 55)",  bg: "oklch(0.68 0.18 55 / 0.12)"  },
  "Completado":    { color: "oklch(0.60 0.18 145)", bg: "oklch(0.60 0.18 145 / 0.12)" },
  "Pausado":       { color: "oklch(0.55 0.04 270)", bg: "oklch(0.55 0.04 270 / 0.12)" },
}

const VERSION_STATE_STYLE = {
  "Pendiente": { color: "oklch(0.55 0.04 270)", bg: "oklch(0.55 0.04 270 / 0.12)" },
  "En curso":  { color: "oklch(0.62 0.18 260)", bg: "oklch(0.62 0.18 260 / 0.12)" },
  "Entregado": { color: "oklch(0.60 0.18 145)", bg: "oklch(0.60 0.18 145 / 0.12)" },
  "Cancelado": { color: "oklch(0.65 0.22 27)",  bg: "oklch(0.65 0.22 27 / 0.12)"  },
}

function getFileTypeInfo(tipo, nombre) {
  const ext = (nombre || "").split(".").pop().toLowerCase()
  if (tipo?.includes("pdf") || ext === "pdf")
    return { label: "PDF", color: "oklch(0.50 0.22 27)",  bg: "oklch(0.65 0.22 27 / 0.15)"  }
  if (tipo?.includes("word") || ["doc","docx"].includes(ext))
    return { label: "DOC", color: "oklch(0.50 0.20 260)", bg: "oklch(0.62 0.18 260 / 0.15)" }
  if (tipo?.includes("sheet") || tipo?.includes("excel") || ["xls","xlsx"].includes(ext))
    return { label: "XLS", color: "oklch(0.50 0.18 145)", bg: "oklch(0.55 0.18 145 / 0.15)" }
  if (tipo?.includes("presentation") || ["ppt","pptx"].includes(ext))
    return { label: "PPT", color: "oklch(0.55 0.22 35)",  bg: "oklch(0.65 0.20 35 / 0.15)"  }
  if (tipo?.includes("image") || ["jpg","jpeg","png","gif","webp"].includes(ext))
    return { label: "IMG", color: "oklch(0.50 0.18 295)", bg: "oklch(0.62 0.18 295 / 0.15)" }
  return                  { label: "FILE", color: "oklch(0.55 0.04 270)", bg: "oklch(0.55 0.04 270 / 0.15)" }
}

function formatFileSize(bytes) {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ColleagueDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, myColleagueId } = useAuth()
  const isOwn = id === myColleagueId
  const isAdmin = ADMIN_EMAILS.includes(user?.email)
  const canEdit = isOwn || isAdmin

  const [companero, setCompanero] = useState(null)
  const [logs, setLogs] = useState([])
  const [grupos, setGrupos] = useState([])
  const [enrutandoProyecto, setEnrutandoProyecto] = useState(null)
  const [grupoSeleccionado, setGrupoSeleccionado] = useState("")
  const [savingEnrute, setSavingEnrute] = useState(false)
  const [nota, setNota] = useState("")
  const [saving, setSaving] = useState(false)
  const [editingLogId, setEditingLogId] = useState(null)
  const [editingLogText, setEditingLogText] = useState("")
  const [showEmoji, setShowEmoji] = useState(false)
  const [projectSearch, setProjectSearch] = useState("")
  const [logSearch, setLogSearch] = useState("")
  const notaRef = useRef(null)

  const [feedback, setFeedback] = useState([])
  const [feedbackText, setFeedbackText] = useState("")
  const [savingFeedback, setSavingFeedback] = useState(false)
  const [editingFbId, setEditingFbId] = useState(null)
  const [editingFbText, setEditingFbText] = useState("")

  const [tasks, setTasks] = useState([])
  const [taskForm, setTaskForm] = useState({ titulo: "", descripcion: "", fechaInicio: "", fechaLimite: "", avance: 0 })
  const [savingTask, setSavingTask] = useState(false)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editingTaskForm, setEditingTaskForm] = useState({})
  const [solicitudMotivo, setSolicitudMotivo] = useState("")
  const [solicitudFecha, setSolicitudFecha] = useState("")
  const [savingSolicitud, setSavingSolicitud] = useState(false)
  const [taskAvanceLocal, setTaskAvanceLocal] = useState({})
  const [savingAvance, setSavingAvance] = useState(null)
  const [openTaskFiles, setOpenTaskFiles] = useState(new Set())
  const [taskFileProgress, setTaskFileProgress] = useState(null)
  const [taskFileError, setTaskFileError] = useState("")

  const [documents, setDocuments] = useState([])
  const [uploadProgress, setUploadProgress] = useState(null)
  const [uploadError, setUploadError] = useState("")
  const [uploadingForProject, setUploadingForProject] = useState(null)
  const [openDocProjects, setOpenDocProjects] = useState(new Set())
  const fileInputRef = useRef(null)
  const taskFileInputRef = useRef(null)
  const uploadingTaskIdRef = useRef(null)

  const loadData = async () => {
    const snap = await getDoc(doc(db, "companeros", id))
    if (snap.exists()) setCompanero({ id: snap.id, ...snap.data() })
    setLogs(await getLogs(id))
  }

  useEffect(() => {
    loadData()
    getGrupos().then(setGrupos)
  }, [id])

  useEffect(() => {
    if (isOwn || isAdmin) getFeedback(id).then(setFeedback)
  }, [id, isOwn, isAdmin])

  useEffect(() => {
    if (isOwn || isAdmin) getTasks(id).then(setTasks)
  }, [id, isOwn, isAdmin])

  useEffect(() => {
    if (isOwn || isAdmin) getDocuments(id).then(setDocuments)
  }, [id, isOwn, isAdmin])

  const handleAddTask = async (e) => {
    e.preventDefault()
    if (!taskForm.titulo.trim()) return
    setSavingTask(true)
    try {
      await addTask(id, taskForm, user)
      if (Number(taskForm.avance) >= 100) {
        notificarTareaCompletada({ taskTitle: taskForm.titulo.trim(), assigneeName: companero?.nombre || id, path: `/colleague/${id}` }).catch(() => {})
      }
      if (companero?.whatsapp) {
        queueTareaNotification({
          colleague: companero,
          tarea: taskForm,
          asignadoPor: user?.displayName || user?.email || "Admin",
        }).catch(() => {})
      }
      // Notificación in-app al compañero
      if (companero?.uid) {
        crearNotificacionUsuario({
          toUid: companero.uid,
          tipo: "tarea_asignada",
          titulo: "Te asignaron una nueva tarea",
          subtitulo: taskForm.titulo.trim(),
          path: `/colleague/${id}`,
        }).catch(() => {})
      }
      setTaskForm({ titulo: "", descripcion: "", fechaInicio: "", fechaLimite: "", avance: 0 })
      setShowTaskForm(false)
      setTasks(await getTasks(id))
    } catch (err) {
      console.error("[Workboard] Error creando tarea:", err.code, err.message)
    }
    setSavingTask(false)
  }

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    if (file.size > MAX_FILE_SIZE) {
      setUploadError("El archivo supera el límite de 15 MB.")
      return
    }
    setUploadError("")
    setUploadProgress(0)
    try {
      const newDoc = await uploadDocument(id, file, {
        onProgress: setUploadProgress,
        uploadedBy: user?.email,
        uploadedByName: user?.displayName || user?.email,
        proyectoNombre: uploadingForProject,
      })
      setDocuments(prev => [newDoc, ...prev])
    } catch (err) {
      console.error("[Workboard] Error subiendo documento:", err)
      setUploadError("Error al subir el archivo. Intenta de nuevo.")
    } finally {
      setUploadProgress(null)
      setUploadingForProject(null)
    }
  }

  const handleDeleteDoc = async (docId, storagePath) => {
    if (!window.confirm("¿Eliminar este documento? Esta acción no se puede deshacer.")) return
    try {
      await deleteDocument(id, docId, storagePath)
      setDocuments(prev => prev.filter(d => d.id !== docId))
    } catch (err) {
      console.error("[Workboard] Error eliminando documento:", err)
    }
  }

  const handleUpdateTaskStatus = async (taskId, nuevoEstado) => {
    try {
      await updateTaskStatus(id, taskId, nuevoEstado)
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, estado: nuevoEstado } : t))
      if (nuevoEstado === "Hecha") {
        const task = tasks.find(t => t.id === taskId)
        notificarTareaCompletada({
          taskTitle: task?.titulo,
          assigneeName: companero?.nombre || id,
          path: `/colleague/${id}`,
        }).catch(() => {})
      }
    } catch (err) {
      console.error("[Workboard] Error actualizando tarea:", err.code, err.message)
    }
  }

  const handleDeleteTask = async (taskId) => {
    if (!confirm("¿Eliminar esta tarea?")) return
    try {
      await deleteTask(id, taskId)
      setTasks(await getTasks(id))
    } catch (err) {
      console.error("[Workboard] Error eliminando tarea:", err.code, err.message)
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
    try {
      await updateTask(id, task.id, data)
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...data } : t))
      if (prevAvance < 100 && newAvance >= 100) {
        notificarTareaCompletada({ taskTitle: data.titulo, assigneeName: colleague?.nombre || id, path: `/colleague/${id}` }).catch(() => {})
      }
      setEditingTaskId(null)
    } catch (err) {
      console.error("[Workboard] Error editando tarea:", err.code, err.message)
    }
  }

  const handleSolicitarPlazo = async (taskId) => {
    if (!solicitudMotivo.trim()) return
    setSavingSolicitud(true)
    try {
      await solicitarPlazoTask(id, taskId, {
        motivo: solicitudMotivo.trim(),
        fechaPropuesta: solicitudFecha || null,
        solicitadoPor: companero?.nombre || user?.displayName || user?.email,
        fecha: new Date().toISOString(),
      })
      setSolicitudPlazoId(null)
      setSolicitudMotivo("")
      setSolicitudFecha("")
      setTasks(await getTasks(id))
    } catch (err) {
      console.error("[Workboard] Error solicitando plazo:", err.code, err.message)
    } finally {
      setSavingSolicitud(false)
    }
  }

  const handleUpdateAvance = async (taskId, newAvance) => {
    setSavingAvance(taskId)
    try {
      const task = tasks.find(t => t.id === taskId)
      const nuevoEstado = newAvance >= 100 ? "Hecha" : undefined
      await updateTaskAvance(id, taskId, newAvance, nuevoEstado)
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, avance: newAvance, ...(nuevoEstado ? { estado: nuevoEstado } : {}) } : t))
      if (newAvance >= 100 && task?.estado !== "Hecha") {
        notificarTareaCompletada({ taskTitle: task?.titulo, assigneeName: companero?.nombre || id, path: `/colleague/${id}` }).catch(() => {})
      }
    } catch (err) {
      console.error("[Workboard] Error actualizando avance:", err)
    } finally {
      setSavingAvance(null)
      setTaskAvanceLocal(prev => { const n = { ...prev }; delete n[taskId]; return n })
    }
  }

  const handleTaskFileSelected = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    const taskId = uploadingTaskIdRef.current
    if (!taskId) return
    if (file.size > MAX_FILE_SIZE) { setTaskFileError("El archivo supera 15 MB."); return }
    setTaskFileError("")
    setTaskFileProgress({ taskId, progress: 0 })
    try {
      const archivo = await uploadTaskFile(id, taskId, file, { onProgress: p => setTaskFileProgress({ taskId, progress: p }) })
      await addTaskFile(id, taskId, archivo)
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, archivos: [...(t.archivos || []), archivo] } : t))
    } catch (err) {
      console.error("[Workboard] Error subiendo archivo de tarea:", err)
      setTaskFileError("Error al subir el archivo.")
    } finally {
      setTaskFileProgress(null)
      uploadingTaskIdRef.current = null
    }
  }

  const handleDeleteTaskFile = async (taskId, archivo) => {
    if (!window.confirm(`¿Eliminar "${archivo.nombre}"?`)) return
    try {
      await deleteTaskFile(archivo.storagePath)
      await removeTaskFile(id, taskId, archivo)
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, archivos: (t.archivos || []).filter(a => a.storagePath !== archivo.storagePath) } : t))
    } catch (err) {
      console.error("[Workboard] Error eliminando archivo de tarea:", err)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar a ${companero.nombre}? No se puede deshacer.`)) return
    await deleteColleague(id)
    navigate("/dashboard")
  }

  const handleDeleteProject = async (proyecto) => {
    if (!confirm(`¿Eliminar el proyecto "${proyecto.nombre}"?`)) return
    await deleteProject(id, proyecto)
    loadData()
  }

  const handleEnrutarProyecto = async () => {
    if (!grupoSeleccionado || !enrutandoProyecto) return
    setSavingEnrute(true)
    try {
      await addGrupoProject(grupoSeleccionado, { ...enrutandoProyecto, enrutadoDe: id })
      setEnrutandoProyecto(null)
      setGrupoSeleccionado("")
      loadData()
    } catch (err) {
      console.error("[Workboard] Error enrutando proyecto:", err)
    } finally {
      setSavingEnrute(false)
    }
  }

  const handleAddLog = async (e) => {
    e.preventDefault()
    if (!nota.trim()) return
    setSaving(true)
    await addLog({ colleagueId: id, colleagueName: companero.nombre, nota, userId: user.uid })
    setNota("")
    setLogs(await getLogs(id))
    setSaving(false)
  }

  const handleDeleteLog = async (logId) => {
    if (!confirm("¿Eliminar esta nota?")) return
    await deleteLog(logId)
    setLogs(prev => prev.filter(l => l.id !== logId))
  }

  const handleEmojiClick = (emojiData) => {
    const el = notaRef.current
    const start = el.selectionStart
    const end = el.selectionEnd
    const newText = nota.substring(0, start) + emojiData.emoji + nota.substring(end)
    setNota(newText)
    setShowEmoji(false)
    setTimeout(() => {
      el.focus()
      el.selectionStart = start + emojiData.emoji.length
      el.selectionEnd = start + emojiData.emoji.length
    }, 0)
  }

  const handleStartEditLog = (log) => {
    setEditingLogId(log.id)
    setEditingLogText(log.nota)
  }

  const handleSaveEditLog = async (logId) => {
    if (!editingLogText.trim()) return
    await updateLog(logId, editingLogText.trim())
    setLogs(prev => prev.map(l => l.id === logId ? { ...l, nota: editingLogText.trim() } : l))
    setEditingLogId(null)
  }

  const handleAddFeedback = async (e) => {
    e.preventDefault()
    if (!feedbackText.trim()) return
    setSavingFeedback(true)
    await addFeedback(id, feedbackText.trim(), user)
    if (companero?.uid) {
      crearNotificacionUsuario({
        toUid: companero.uid,
        tipo: "feedback_recibido",
        titulo: "Tienes nueva retroalimentación",
        subtitulo: feedbackText.trim().slice(0, 80),
        path: `/colleague/${id}`,
      }).catch(() => {})
    }
    setFeedbackText("")
    setFeedback(await getFeedback(id))
    setSavingFeedback(false)
  }

  const handleDeleteFeedback = async (fbId) => {
    if (!confirm("¿Eliminar esta retroalimentación?")) return
    try {
      await deleteFeedback(id, fbId)
      setFeedback(await getFeedback(id))
    } catch (err) {
      console.error("[Workboard] Error eliminando retroalimentación:", err.code, err.message)
    }
  }

  const handleSaveEditFeedback = async (fbId) => {
    if (!editingFbText.trim()) return
    await updateFeedback(id, fbId, editingFbText.trim())
    setFeedback(prev => prev.map(f => f.id === fbId ? { ...f, texto: editingFbText.trim() } : f))
    setEditingFbId(null)
  }

  if (!companero) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground text-sm">Cargando…</p>
    </div>
  )

  const h = companero.colorHue ?? hashHue(id)

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-border/60 px-6 py-3 flex justify-between items-center"
        style={{ backgroundColor: "color-mix(in srgb, var(--background) 85%, transparent)", backdropFilter: "blur(20px)" }}>
        <button onClick={() => navigate("/dashboard")}
          className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors">
          ← Volver
        </button>
        <ThemeToggle />
      </header>

      {/* ── Hero ── */}
      <div className="relative overflow-hidden px-6 py-12"
        style={{ background: `linear-gradient(145deg, oklch(0.20 0.050 ${h}), oklch(0.15 0.035 ${(h + 30) % 360}))` }}>

        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-72 h-72 opacity-30"
            style={{ background: `radial-gradient(circle at top right, oklch(0.72 0.18 ${h}), transparent 65%)`, filter: "blur(40px)" }} />
          <div className="absolute bottom-0 left-0 w-48 h-48 opacity-20"
            style={{ background: `radial-gradient(circle, oklch(0.65 0.16 ${(h + 50) % 360}), transparent 65%)`, filter: "blur(30px)" }} />
        </div>

        <div className="max-w-4xl mx-auto w-full relative">
          <div className="flex flex-col sm:flex-row sm:items-end gap-5">

            {/* Avatar */}
            <div className="w-20 h-20 rounded-2xl flex-shrink-0 flex items-center justify-center text-white font-bold text-3xl overflow-hidden"
              style={{
                background: companero.avatarUrl ? "var(--card)" : `linear-gradient(135deg, oklch(0.68 0.18 ${h}), oklch(0.54 0.22 ${(h + 40) % 360}))`,
                boxShadow: `0 12px 32px oklch(0.55 0.20 ${h} / 45%), 0 0 0 2px oklch(0.72 0.14 ${h} / 30%)`,
              }}>
              {companero.avatarUrl
                ? <img src={companero.avatarUrl} alt={companero.nombre} className="w-full h-full object-cover" />
                : companero.avatarEmoji
                  ? <span className="text-4xl leading-none">{companero.avatarEmoji}</span>
                  : companero.nombre?.charAt(0).toUpperCase()
              }
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-[28px] font-bold text-white leading-tight tracking-tight">{companero.nombre}</h1>
              <p className="text-[14px] mt-1" style={{ color: `oklch(0.78 0.08 ${h})` }}>
                {companero.rol || "Sin rol registrado"}
              </p>
              {companero.area && (
                <span className="inline-block text-[11px] font-semibold px-3 py-1 rounded-full mt-2.5"
                  style={{ backgroundColor: `oklch(0.28 0.06 ${h})`, color: `oklch(0.88 0.10 ${h})` }}>
                  {companero.area}
                </span>
              )}
            </div>

            {/* Actions — solo visible para el dueño o creador del perfil */}
            {canEdit && (
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => navigate(`/colleague/${id}/edit`)}
                  className="text-[12px] font-semibold px-4 py-2 rounded-xl border transition-all"
                  style={{
                    borderColor: `oklch(0.55 0.14 ${h} / 0.4)`,
                    color: `oklch(0.88 0.08 ${h})`,
                    backgroundColor: `oklch(0.28 0.06 ${h} / 0.35)`,
                  }}>
                  Editar
                </button>
                <button onClick={handleDelete}
                  className="text-[12px] font-semibold px-4 py-2 rounded-xl text-white transition-all hover:opacity-80"
                  style={{ backgroundColor: "oklch(0.48 0.20 27)" }}>
                  Eliminar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-8 w-full flex-1 space-y-6">

        {/* ── Info principal ── */}
        {(companero.trabajaEn || companero.herramientas?.length > 0 || companero.notas) && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden"
            style={{ borderLeftColor: `oklch(0.60 0.18 ${h})`, borderLeftWidth: "3px" }}>
            <div className="p-6 space-y-5">
              {companero.trabajaEn && (
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Trabajando en</p>
                  <p className="text-[14px] text-foreground leading-relaxed">{companero.trabajaEn}</p>
                </div>
              )}
              {companero.herramientas?.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Herramientas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {companero.herramientas.map(tool => (
                      <span key={tool} className="text-[12px] px-2.5 py-1 rounded-lg font-medium"
                        style={{ backgroundColor: `oklch(0.60 0.18 ${h} / 0.10)`, color: `oklch(0.48 0.18 ${h})` }}>
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {companero.notas && (
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Notas</p>
                  <p className="text-[14px] text-foreground leading-relaxed">{companero.notas}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Proyectos ── */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-[18px] font-bold text-foreground tracking-tight">
              Proyectos
              {companero.proyectos?.length > 0 && (
                <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                  ({companero.proyectos.length})
                </span>
              )}
            </h2>
            {canEdit && (
              <Button size="sm" className="text-[13px] h-8" onClick={() => navigate(`/colleague/${id}/project/new`)}>
                + Proyecto
              </Button>
            )}
          </div>

          {companero.proyectos?.length > 0 && (
            <div className="relative mb-3">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="text"
                placeholder="Buscar proyecto…"
                value={projectSearch}
                onChange={e => setProjectSearch(e.target.value)}
                className="w-full h-9 bg-card border border-border rounded-xl pl-8 pr-4 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/30 transition-all"
              />
            </div>
          )}

          {(() => {
            const q = projectSearch.toLowerCase()
            const filtered = (companero.proyectos || []).filter(p =>
              !q ||
              p.nombre?.toLowerCase().includes(q) ||
              p.queHace?.toLowerCase().includes(q) ||
              p.herramientas?.some(t => t.toLowerCase().includes(q)) ||
              p.area?.toLowerCase().includes(q)
            )
            return filtered.length > 0 ? (
            <div className="overflow-y-auto space-y-3 pr-0.5" style={{ maxHeight: "520px" }}>
              {filtered.map((proyecto, index) => {
                const pH = (h + index * 55) % 360
                const pState = proyecto.estado ? PROJECT_STATE_STYLE[proyecto.estado] : null
                return (
                  <div key={index} className="bg-card border border-border rounded-2xl overflow-hidden group"
                    style={{ borderLeftColor: `oklch(0.60 0.16 ${pH})`, borderLeftWidth: "3px" }}>
                    <div className="p-5">

                      {/* Project header */}
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 min-w-0 mr-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-foreground text-[15px] leading-tight">{proyecto.nombre}</h3>
                            {pState && (
                              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full flex-shrink-0"
                                style={{ color: pState.color, backgroundColor: pState.bg }}>
                                {proyecto.estado}
                              </span>
                            )}
                          </div>
                          {proyecto.area && (
                            <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1.5"
                              style={{ backgroundColor: `oklch(0.58 0.12 ${pH} / 0.18)`, color: `oklch(0.58 0.16 ${pH})` }}>
                              {proyecto.area}
                            </span>
                          )}
                        </div>
                        {canEdit && (
                          <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button
                              onClick={() => navigate(`/colleague/${id}/project/new`, { state: { editProject: proyecto } })}
                              className="text-[12px] font-semibold hover:opacity-70 transition-opacity"
                              style={{ color: `oklch(0.42 0.16 ${pH})` }}>
                              Editar
                            </button>
                            {grupos.length > 0 && (
                              <button
                                onClick={() => { setEnrutandoProyecto(proyecto); setGrupoSeleccionado("") }}
                                className="text-[12px] font-semibold hover:opacity-70 transition-opacity"
                                style={{ color: "oklch(0.38 0.18 145)" }}>
                                → Grupo
                              </button>
                            )}
                            <button onClick={() => handleDeleteProject(proyecto)}
                              className="text-[12px] font-semibold text-destructive hover:opacity-70 transition-opacity">
                              Eliminar
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Enrutar proyecto a grupo — panel separado debajo del encabezado */}
                      {enrutandoProyecto?.nombre === proyecto.nombre && enrutandoProyecto?.fechaInicio === proyecto.fechaInicio && (
                        <div className="mb-4 p-4 rounded-xl space-y-3"
                          style={{ background: `oklch(0.60 0.16 145 / 0.08)`, border: `1px solid oklch(0.55 0.16 145 / 0.35)` }}>
                          <p className="text-[13px] font-bold" style={{ color: "oklch(0.40 0.16 145)" }}>
                            Mover proyecto al grupo
                          </p>
                          <select
                            value={grupoSeleccionado}
                            onChange={e => setGrupoSeleccionado(e.target.value)}
                            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40">
                            <option value="">Selecciona un grupo…</option>
                            {grupos.map(g => (
                              <option key={g.id} value={g.id}>{g.nombre}</option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <button
                              onClick={handleEnrutarProyecto}
                              disabled={!grupoSeleccionado || savingEnrute}
                              className="h-8 px-4 rounded-lg text-[12px] font-bold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                              style={{ background: "oklch(0.52 0.18 145)" }}>
                              {savingEnrute ? "Moviendo…" : "Confirmar"}
                            </button>
                            <button
                              onClick={() => { setEnrutandoProyecto(null); setGrupoSeleccionado("") }}
                              className="h-8 px-4 rounded-lg text-[12px] font-semibold border border-border text-foreground hover:bg-muted transition-colors">
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Avance — solo admin y dueño */}
                      {(isOwn || isAdmin) && (
                        <div className="mb-2.5">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Avance</span>
                            <span className="text-[12px] font-bold tabular-nums"
                              style={{ color: (proyecto.avance ?? 0) >= 75 ? "oklch(0.60 0.18 145)" : (proyecto.avance ?? 0) >= 50 ? "oklch(0.60 0.18 260)" : (proyecto.avance ?? 0) >= 25 ? "oklch(0.68 0.18 55)" : "oklch(0.65 0.22 27)" }}>
                              {proyecto.avance ?? 0}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "oklch(0.40 0.02 260 / 0.3)" }}>
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${proyecto.avance ?? 0}%`,
                                background: (proyecto.avance ?? 0) >= 75
                                  ? "linear-gradient(90deg, oklch(0.55 0.18 145), oklch(0.62 0.20 155))"
                                  : (proyecto.avance ?? 0) >= 50
                                    ? "linear-gradient(90deg, oklch(0.55 0.18 260), oklch(0.62 0.20 280))"
                                    : (proyecto.avance ?? 0) >= 25
                                      ? "linear-gradient(90deg, oklch(0.60 0.18 55), oklch(0.68 0.20 65))"
                                      : "linear-gradient(90deg, oklch(0.60 0.22 27), oklch(0.65 0.22 35))",
                              }} />
                          </div>
                        </div>
                      )}

                      {/* Content */}
                      {proyecto.queHace && (
                        <p className="text-[13px] text-muted-foreground mb-2.5 leading-relaxed">
                          <span className="font-semibold text-foreground">Qué hace: </span>{proyecto.queHace}
                        </p>
                      )}

                      {proyecto.herramientas?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2.5">
                          {proyecto.herramientas.map(tool => (
                            <span key={tool} className="text-[11px] px-2.5 py-0.5 rounded-lg font-semibold"
                              style={{ backgroundColor: `oklch(0.58 0.10 ${pH} / 0.16)`, color: `oklch(0.58 0.13 ${pH})` }}>
                              {tool}
                            </span>
                          ))}
                        </div>
                      )}

                      {proyecto.observaciones && (
                        <p className="text-[13px] text-muted-foreground leading-relaxed mb-2.5">
                          <span className="font-semibold text-foreground">Observaciones: </span>{proyecto.observaciones}
                        </p>
                      )}

                      {/* Timeline */}
                      {(proyecto.fechaInicio || proyecto.fechaEntrega || proyecto.versiones?.length > 0) && (
                        <div className="mt-3 pt-3 border-t border-border space-y-2">
                          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                            {proyecto.fechaInicio && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-muted-foreground">Inicio:</span>
                                <span className="text-[11px] font-semibold text-foreground">
                                  {format(parseLocalDate(proyecto.fechaInicio), "d MMM yyyy", { locale: es })}
                                </span>
                              </div>
                            )}
                            {proyecto.fechaEntrega && (() => {
                              const done = proyecto.estado === "Completado"
                              const st = done ? null : deadlineStatus(proyecto.fechaEntrega)
                              return (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[11px] text-muted-foreground">Entrega:</span>
                                  <span className="text-[11px] font-semibold text-foreground">
                                    {format(parseLocalDate(proyecto.fechaEntrega), "d MMM yyyy", { locale: es })}
                                  </span>
                                  {st && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                      style={{ color: st.color, backgroundColor: st.bg }}>
                                      {st.label}
                                    </span>
                                  )}
                                </div>
                              )
                            })()}
                          </div>

                          {proyecto.versiones?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              
                              {proyecto.versiones.map((v, vi) => {
                                const vStyle = v.estado ? VERSION_STATE_STYLE[v.estado] : null
                                return (
                                  <span key={vi}
                                    className="text-[11px] px-2.5 py-1 rounded-lg border border-border text-muted-foreground flex items-center gap-1.5"
                                    style={vStyle ? { borderColor: vStyle.color + "44", backgroundColor: vStyle.bg } : {}}>
                                    <span className="font-semibold" style={{ color: vStyle ? vStyle.color : `oklch(0.60 0.14 ${pH})` }}>
                                      {v.nombre}
                                    </span>
                                    {v.fecha && (
                                      <span className="opacity-70">— {format(parseLocalDate(v.fecha), "d MMM", { locale: es })}</span>
                                    )}
                                    {v.estado && (
                                      <span className="font-bold" style={{ color: vStyle?.color }}>· {v.estado}</span>
                                    )}
                                  </span>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── Archivos del proyecto ── */}
                      {(isAdmin || isOwn) && (() => {
                        const proyDocs = documents.filter(d => d.proyectoNombre === proyecto.nombre)
                        const isOpen = openDocProjects.has(proyecto.nombre)
                        const isUploading = uploadingForProject === proyecto.nombre && uploadProgress !== null
                        return (
                          <div className="mt-3 pt-3 border-t border-border">
                            <div className="flex items-center justify-between">
                              <button
                                onClick={() => setOpenDocProjects(prev => {
                                  const next = new Set(prev)
                                  isOpen ? next.delete(proyecto.nombre) : next.add(proyecto.nombre)
                                  return next
                                })}
                                className="flex items-center gap-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
                                <span>Archivos</span>
                                {proyDocs.length > 0 && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                                    style={{ background: `oklch(0.60 0.14 ${pH} / 0.15)`, color: `oklch(0.60 0.14 ${pH})` }}>
                                    {proyDocs.length}
                                  </span>
                                )}
                                <span className="text-[10px] opacity-50 ml-0.5">{isOpen ? "▲" : "▼"}</span>
                              </button>
                              {(isAdmin || isOwn) && (
                                <button
                                  onClick={() => { setUploadingForProject(proyecto.nombre); fileInputRef.current?.click() }}
                                  disabled={uploadProgress !== null}
                                  className="text-[11px] font-semibold px-3 py-1 rounded-lg text-white disabled:opacity-50 transition-all hover:opacity-90"
                                  style={{ background: `oklch(0.55 0.16 ${pH})` }}>
                                  {isUploading ? `${uploadProgress}%` : "↑ Subir"}
                                </button>
                              )}
                            </div>
                            {isUploading && (
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                                <div className="h-full rounded-full transition-all"
                                  style={{ width: `${uploadProgress}%`, background: `oklch(0.55 0.16 ${pH})` }} />
                              </div>
                            )}
                            {uploadingForProject === proyecto.nombre && uploadError && (
                              <p className="text-[11px] text-destructive mt-1">{uploadError}</p>
                            )}
                            {isOpen && (
                              <div className="mt-2 space-y-1.5">
                                {proyDocs.length > 0 ? proyDocs.map(documento => {
                                  const typeInfo = getFileTypeInfo(documento.tipo, documento.nombre)
                                  return (
                                    <div key={documento.id}
                                      className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded flex-shrink-0"
                                        style={{ background: typeInfo.bg, color: typeInfo.color }}>
                                        {typeInfo.label}
                                      </span>
                                      <span className="text-[12px] text-foreground truncate flex-1 min-w-0">{documento.nombre}</span>
                                      <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatFileSize(documento.size)}</span>
                                      <a href={documento.url} target="_blank" rel="noopener noreferrer"
                                        className="text-[14px] text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                                        title="Abrir / descargar">↓</a>
                                      {isAdmin && (
                                        <button onClick={() => handleDeleteDoc(documento.id, documento.storagePath)}
                                          className="text-[12px] text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                                          title="Eliminar">✕</button>
                                      )}
                                    </div>
                                  )
                                }) : (
                                  <p className="text-[11px] text-muted-foreground text-center py-2">Sin archivos subidos aún.</p>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-2xl">
              <p className="text-[13px]">{projectSearch ? "Sin resultados para esa búsqueda." : "Sin proyectos registrados."}</p>
            </div>
          )
        })()}
        </div>

        {/* ── Bitácora ── */}
        <div>
          <h2 className="text-[18px] font-bold text-foreground tracking-tight mb-4">Bitácora</h2>

          {/* Formulario: para el dueño del perfil o el admin */}
          {(isAdmin || isOwn) && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden mb-3"
              style={{ borderTopColor: `oklch(0.60 0.16 ${h})`, borderTopWidth: "3px" }}>
              <form onSubmit={handleAddLog} className="p-5">
                <div className="flex justify-end mb-2.5">
                  <button type="button" onClick={() => setShowEmoji(v => !v)}
                    className="text-lg leading-none hover:scale-110 transition-transform" title="Insertar emoji">
                    😊
                  </button>
                </div>
                {showEmoji && (
                  <div className="mb-3 rounded-xl overflow-hidden">
                    <EmojiPicker onEmojiClick={handleEmojiClick} width="100%" height={330}
                      searchPlaceholder="Buscar emoji…" skinTonesDisabled
                      previewConfig={{ showPreview: false }} />
                  </div>
                )}
                <textarea ref={notaRef} value={nota} onChange={e => setNota(e.target.value)}
                  placeholder="¿En qué estás trabajando esta semana?"
                  rows={3}
                  className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground mb-3 focus:outline-none focus:ring-2 focus:ring-ring/40 resize-none transition-all" />
                <button type="submit" disabled={saving}
                  className="text-[13px] font-semibold px-5 py-2 rounded-xl text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, oklch(0.58 0.20 ${h}), oklch(0.50 0.22 ${(h + 25) % 360}))` }}>
                  {saving ? "Guardando…" : "Guardar nota"}
                </button>
              </form>
            </div>
          )}

          {logs.length > 0 && (
            <div className="relative mb-3">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="text"
                placeholder="Buscar en bitácora…"
                value={logSearch}
                onChange={e => setLogSearch(e.target.value)}
                className="w-full h-9 bg-card border border-border rounded-xl pl-8 pr-4 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/30 transition-all"
              />
            </div>
          )}

          {(() => {
            const q = logSearch.toLowerCase()
            const filteredLogs = logs.filter(l => !q || l.nota?.toLowerCase().includes(q))
            return filteredLogs.length > 0 ? (
            <div className="overflow-y-auto space-y-2 pr-0.5" style={{ maxHeight: "420px" }}>
              {filteredLogs.map(log => (
                <div key={log.id} className="bg-card border border-border rounded-xl p-4 group">
                  {editingLogId === log.id ? (
                    <div className="space-y-2">
                      <textarea value={editingLogText} onChange={e => setEditingLogText(e.target.value)}
                        rows={3}
                        className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 resize-none" />
                      <div className="flex gap-2">
                        <button onClick={() => handleSaveEditLog(log.id)}
                          className="text-[12px] font-semibold px-3.5 py-1.5 rounded-lg text-white"
                          style={{ backgroundColor: `oklch(0.55 0.16 ${h})` }}>
                          Guardar
                        </button>
                        <button onClick={() => setEditingLogId(null)}
                          className="text-[12px] font-medium px-3.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full mt-[7px] flex-shrink-0"
                        style={{ backgroundColor: `oklch(0.62 0.16 ${h})` }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] text-foreground leading-relaxed">{log.nota}</p>
                        <div className="flex justify-between items-center mt-1.5">
                          <p className="text-[11px] text-muted-foreground capitalize">
                            {log.createdAt?.toDate
                              ? format(log.createdAt.toDate(), "EEEE d 'de' MMMM, yyyy", { locale: es })
                              : ""}
                          </p>
                          {(isOwn || log.creadoPor === user?.uid || isAdmin) && (
                            <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleStartEditLog(log)}
                                className="text-[12px] font-semibold hover:opacity-70 transition-opacity"
                                style={{ color: `oklch(0.42 0.16 ${h})` }}>
                                Editar
                              </button>
                              <button onClick={() => handleDeleteLog(log.id)}
                                className="text-[12px] text-destructive hover:opacity-70 transition-opacity">
                                Eliminar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-2xl">
              <p className="text-[13px]">{logSearch ? "Sin resultados para esa búsqueda." : "Sin notas aún. Agrega la primera."}</p>
            </div>
          )
        })()}
        </div>

        {/* ── Retroalimentación — solo admin y dueño del perfil ── */}
        {(isOwn || isAdmin) && (
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <h2 className="text-[18px] font-bold text-foreground tracking-tight">Retroalimentación</h2>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                style={{ backgroundColor: "oklch(0.70 0.18 55 / 0.12)", color: "oklch(0.58 0.16 50)" }}>
                🔒 Privado
              </span>
            </div>

            {/* Formulario — solo admins */}
            {isAdmin && (
              <div className="bg-card border border-border rounded-2xl overflow-hidden mb-3"
                style={{ borderTopColor: "oklch(0.68 0.18 55)", borderTopWidth: "3px" }}>
                <form onSubmit={handleAddFeedback} className="p-5">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                    Escribe retroalimentación para {companero.nombre}
                  </p>
                  {editingFbId ? (
                    <div className="space-y-2">
                      <textarea value={editingFbText} onChange={e => setEditingFbText(e.target.value)}
                        rows={3}
                        className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 resize-none transition-all" />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => handleSaveEditFeedback(editingFbId)}
                          className="text-[13px] font-semibold px-5 py-2 rounded-xl text-white transition-all hover:opacity-90"
                          style={{ background: "linear-gradient(135deg, oklch(0.62 0.18 55), oklch(0.55 0.20 40))" }}>
                          Guardar cambios
                        </button>
                        <button type="button" onClick={() => setEditingFbId(null)}
                          className="text-[13px] font-medium px-4 py-2 rounded-xl border border-border text-muted-foreground hover:text-foreground transition-colors">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)}
                        placeholder="Ej: Buen avance esta semana, recuerda documentar los cambios…"
                        rows={3}
                        className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground mb-3 focus:outline-none focus:ring-2 focus:ring-ring/40 resize-none transition-all" />
                      <button type="submit" disabled={savingFeedback}
                        className="text-[13px] font-semibold px-5 py-2 rounded-xl text-white transition-all hover:opacity-90 disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg, oklch(0.62 0.18 55), oklch(0.55 0.20 40))" }}>
                        {savingFeedback ? "Enviando…" : "Enviar retroalimentación"}
                      </button>
                    </>
                  )}
                </form>
              </div>
            )}

            {/* Lista de retroalimentaciones */}
            {feedback.length > 0 ? (
              <div className="overflow-y-auto space-y-3 pr-0.5" style={{ maxHeight: "460px" }}>
                {feedback.map(fb => {
                  const authorName = fb.creadoPorNombre || fb.creadoPorEmail || "Admin"
                  const authorInitial = authorName.charAt(0).toUpperCase()
                  return (
                    <div key={fb.id} className="rounded-xl overflow-hidden border group"
                      style={{
                        borderColor: "oklch(0.68 0.18 55 / 0.35)",
                        backgroundColor: "oklch(0.65 0.14 55 / 0.07)",
                      }}>

                      {/* Cabecera con autor — visualmente distinta de la bitácora */}
                      <div className="flex items-center justify-between px-4 py-2.5 border-b"
                        style={{ borderColor: "oklch(0.68 0.18 55 / 0.20)", backgroundColor: "oklch(0.65 0.16 55 / 0.10)" }}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                            style={{ background: "linear-gradient(135deg, oklch(0.65 0.20 50), oklch(0.55 0.22 38))" }}>
                            {authorInitial}
                          </div>
                          <span className="text-[13px] font-semibold" style={{ color: "oklch(0.68 0.18 50)" }}>
                            {authorName}
                          </span>
                          {fb.createdAt?.toDate && (
                            <span className="text-[11px] text-muted-foreground">
                              · {format(fb.createdAt.toDate(), "d 'de' MMMM, yyyy", { locale: es })}
                            </span>
                          )}
                        </div>
                        {isAdmin && (
                          <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => { setEditingFbId(fb.id); setEditingFbText(fb.texto) }}
                              className="text-[12px] font-semibold hover:opacity-70 transition-opacity"
                              style={{ color: "oklch(0.40 0.16 55)" }}>
                              Editar
                            </button>
                            <button onClick={() => handleDeleteFeedback(fb.id)}
                              className="text-[12px] text-destructive hover:opacity-70 transition-opacity">
                              Eliminar
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Contenido */}
                      <div className="px-4 py-3">
                        <p className="text-[14px] text-foreground leading-relaxed">{fb.texto}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground bg-card border border-border rounded-2xl">
                <p className="text-[13px]">
                  {isAdmin ? "Aún no hay retroalimentación para esta persona." : "Aún no tienes retroalimentación."}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Tareas — solo admin y dueño del perfil ── */}
        {(isOwn || isAdmin) && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <h2 className="text-[18px] font-bold text-foreground tracking-tight">Tareas</h2>
                {tasks.length > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "oklch(0.60 0.18 260 / 0.12)", color: "oklch(0.55 0.18 260)" }}>
                    {tasks.filter(t => t.estado !== "Hecha").length} pendientes
                  </span>
                )}
              </div>
              {isAdmin && (
                <button onClick={() => setShowTaskForm(v => !v)}
                  className="text-[12px] font-semibold h-8 px-3 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
                  {showTaskForm ? "Cancelar" : "+ Tarea"}
                </button>
              )}
            </div>

            {/* Formulario nueva tarea — solo admins */}
            {isAdmin && showTaskForm && (
              <div className="bg-card border border-border rounded-2xl overflow-hidden mb-3"
                style={{ borderTopColor: "oklch(0.60 0.18 260)", borderTopWidth: "3px" }}>
                <form onSubmit={handleAddTask} className="p-5 space-y-3">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                    Nueva tarea para {companero.nombre}
                  </p>
                  <input
                    value={taskForm.titulo} onChange={e => setTaskForm(f => ({ ...f, titulo: e.target.value }))}
                    placeholder="Título de la tarea *"
                    className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all" />
                  <textarea
                    value={taskForm.descripcion} onChange={e => setTaskForm(f => ({ ...f, descripcion: e.target.value }))}
                    placeholder="Descripción o instrucciones (opcional)"
                    rows={2}
                    className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 resize-none transition-all" />
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-[12px] font-medium text-muted-foreground mb-1">Fecha inicio</label>
                      <input type="date" value={taskForm.fechaInicio} onChange={e => setTaskForm(f => ({ ...f, fechaInicio: e.target.value }))}
                        className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[12px] font-medium text-muted-foreground mb-1">Fecha límite</label>
                      <input type="date" value={taskForm.fechaLimite} onChange={e => setTaskForm(f => ({ ...f, fechaLimite: e.target.value }))}
                        className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-muted-foreground mb-1">Avance inicial: {taskForm.avance}%</label>
                    <input type="range" min="0" max="100" step="5" value={taskForm.avance}
                      onChange={e => setTaskForm(f => ({ ...f, avance: e.target.value }))}
                      className="w-full accent-primary" />
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" disabled={savingTask}
                      className="h-10 px-5 rounded-xl text-[13px] font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg, oklch(0.58 0.20 260), oklch(0.50 0.22 280))" }}>
                      {savingTask ? "Guardando…" : "Guardar tarea"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Lista de tareas */}
            {tasks.length > 0 ? (
              <div className="space-y-2">
                {tasks.map(task => {
                  const vencida = task.fechaLimite && task.estado !== "Hecha" && new Date(task.fechaLimite) < new Date()
                  const estadoColors = {
                    "Pendiente": { color: "oklch(0.65 0.22 27)", bg: "oklch(0.65 0.22 27 / 0.10)" },
                    "En proceso": { color: "oklch(0.62 0.18 260)", bg: "oklch(0.62 0.18 260 / 0.10)" },
                    "Hecha":      { color: "oklch(0.60 0.18 145)", bg: "oklch(0.60 0.18 145 / 0.10)" },
                  }
                  const st = estadoColors[task.estado] || estadoColors["Pendiente"]
                  return (
                    <div key={task.id} className="bg-card border border-border rounded-xl p-4 group">
                      {editingTaskId === task.id ? (
                        /* ── Formulario edición inline ── */
                        <div className="space-y-3">
                          {/* Campos de edición — solo admin */}
                          {isAdmin && (
                            <>
                              <input value={editingTaskForm.titulo}
                                onChange={e => setEditingTaskForm(f => ({ ...f, titulo: e.target.value }))}
                                placeholder="Título *"
                                className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40" />
                              <textarea value={editingTaskForm.descripcion}
                                onChange={e => setEditingTaskForm(f => ({ ...f, descripcion: e.target.value }))}
                                placeholder="Descripción (opcional)" rows={2}
                                className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 resize-none" />
                              <div className="flex gap-3">
                                <div className="flex-1">
                                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">Fecha inicio</label>
                                  <input type="date" value={editingTaskForm.fechaInicio || ""}
                                    onChange={e => setEditingTaskForm(f => ({ ...f, fechaInicio: e.target.value }))}
                                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40" />
                                </div>
                                <div className="flex-1">
                                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">Fecha límite</label>
                                  <input type="date" value={editingTaskForm.fechaLimite || ""}
                                    onChange={e => setEditingTaskForm(f => ({ ...f, fechaLimite: e.target.value }))}
                                    className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40" />
                                </div>
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                                  Avance: <span className="font-bold text-foreground">{editingTaskForm.avance ?? 0}%</span>
                                </label>
                                <input type="range" min="0" max="100" step="5" value={editingTaskForm.avance ?? 0}
                                  onChange={e => setEditingTaskForm(f => ({ ...f, avance: Number(e.target.value) }))}
                                  className="w-full accent-primary" />
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => handleSaveEditTask(task)}
                                  className="h-8 px-4 rounded-xl text-[12px] font-bold text-white transition-all hover:opacity-90"
                                  style={{ background: "linear-gradient(135deg, oklch(0.58 0.20 260), oklch(0.50 0.22 280))" }}>
                                  Guardar
                                </button>
                                <button onClick={() => { setEditingTaskId(null); setSolicitudMotivo(""); setSolicitudFecha("") }}
                                  className="h-8 px-4 rounded-xl text-[12px] font-medium border border-border text-muted-foreground hover:text-foreground transition-colors">
                                  Cancelar
                                </button>
                              </div>
                            </>
                          )}

                          {/* Solicitud de más tiempo — dentro del formulario */}
                          {isOwn && task.estado !== "Hecha" && (
                            <div className={isAdmin ? "pt-3 border-t border-border space-y-2" : "space-y-2"}>
                              <p className="text-[12px] font-semibold text-foreground">⏳ Solicitar más tiempo</p>
                              {task.solicitudPlazo ? (
                                <div className="px-3 py-2 rounded-lg space-y-1"
                                  style={{ background: "oklch(0.68 0.18 55 / 0.10)", border: "1px solid oklch(0.68 0.18 55 / 0.30)" }}>
                                  <p className="text-[11px] font-bold" style={{ color: "oklch(0.58 0.20 55)" }}>Solicitud enviada</p>
                                  <p className="text-[12px] text-foreground">{task.solicitudPlazo.motivo}</p>
                                  {task.solicitudPlazo.fechaPropuesta && (
                                    <p className="text-[11px] text-muted-foreground">
                                      Fecha propuesta: {format(new Date(task.solicitudPlazo.fechaPropuesta + "T00:00:00"), "d 'de' MMMM, yyyy", { locale: es })}
                                    </p>
                                  )}
                                  <button onClick={async () => { await cancelarPlazoTask(id, task.id); setTasks(await getTasks(id)) }}
                                    className="text-[11px] text-destructive hover:opacity-70 transition-opacity mt-1">
                                    Cancelar solicitud
                                  </button>
                                </div>
                              ) : (
                                <>
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
                                    <button onClick={() => handleSolicitarPlazo(task.id)}
                                      disabled={savingSolicitud || !solicitudMotivo.trim()}
                                      className="h-7 px-3 rounded-lg text-[11px] font-bold text-white disabled:opacity-50"
                                      style={{ background: "oklch(0.58 0.20 55)" }}>
                                      {savingSolicitud ? "Enviando…" : "Enviar solicitud"}
                                    </button>
                                    {!isAdmin && (
                                      <button onClick={() => { setEditingTaskId(null); setSolicitudMotivo(""); setSolicitudFecha("") }}
                                        className="h-7 px-3 rounded-lg text-[11px] border border-border text-muted-foreground hover:text-foreground">
                                        Cerrar
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* ── Vista normal ── */
                        <div className="flex gap-3 items-start">
                          <button
                            onClick={() => handleUpdateTaskStatus(task.id,
                              task.estado === "Pendiente" ? "En proceso" : task.estado === "En proceso" ? "Hecha" : "Pendiente")}
                            className="w-5 h-5 rounded-md border-2 flex-shrink-0 mt-0.5 transition-all hover:scale-110"
                            style={{ borderColor: st.color, backgroundColor: task.estado === "Hecha" ? st.color : "transparent" }}
                            title="Cambiar estado">
                            {task.estado === "Hecha" && (
                              <svg viewBox="0 0 12 12" fill="none" className="w-full h-full p-0.5">
                                <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                            {task.estado === "En proceso" && (
                              <div className="w-full h-full rounded-sm" style={{ backgroundColor: st.color, margin: "2px" }} />
                            )}
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-[14px] font-semibold leading-snug ${task.estado === "Hecha" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                {task.titulo}
                              </p>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                  style={{ color: st.color, backgroundColor: st.bg }}>
                                  {task.estado}
                                </span>
                                {isAdmin && (
                                  <button onClick={() => { setEditingTaskId(task.id); setSolicitudMotivo(""); setSolicitudFecha(""); setEditingTaskForm({ titulo: task.titulo, descripcion: task.descripcion || "", fechaInicio: task.fechaInicio || "", fechaLimite: task.fechaLimite || "", avance: task.avance ?? 0 }) }}
                                    className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                  </button>
                                )}
                                {isOwn && !isAdmin && task.estado !== "Hecha" && !task.solicitudPlazo && (
                                  <button onClick={() => { setEditingTaskId(task.id); setSolicitudMotivo(""); setSolicitudFecha("") }}
                                    className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
                                    title="Solicitar más tiempo">
                                    ⏳
                                  </button>
                                )}
                                {isAdmin && (
                                  <button onClick={() => handleDeleteTask(task.id)}
                                    className="text-[11px] text-destructive opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-70">
                                    ✕
                                  </button>
                                )}
                              </div>
                            </div>
                            {task.descripcion && (
                              <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">{task.descripcion}</p>
                            )}
                            {/* Avance — slider interactivo para el dueño no-admin, barra de solo lectura para el resto */}
                            {isOwn && !isAdmin && task.estado !== "Hecha" ? (
                              <div className="mt-2">
                                <div className="flex justify-between text-[10px] mb-1">
                                  <span className="text-muted-foreground font-medium">Avance</span>
                                  <span className="font-bold tabular-nums" style={{ color: (taskAvanceLocal[task.id] ?? task.avance ?? 0) >= 100 ? "oklch(0.55 0.18 145)" : (taskAvanceLocal[task.id] ?? task.avance ?? 0) >= 50 ? "oklch(0.55 0.18 260)" : "oklch(0.60 0.18 55)" }}>
                                    {taskAvanceLocal[task.id] ?? task.avance ?? 0}%
                                  </span>
                                </div>
                                <input type="range" min="0" max="100" step="5"
                                  value={taskAvanceLocal[task.id] ?? task.avance ?? 0}
                                  onChange={e => setTaskAvanceLocal(prev => ({ ...prev, [task.id]: Number(e.target.value) }))}
                                  disabled={savingAvance === task.id}
                                  className="w-full accent-primary disabled:opacity-50" />
                                {taskAvanceLocal[task.id] != null && taskAvanceLocal[task.id] !== (task.avance ?? 0) && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <button onClick={() => handleUpdateAvance(task.id, taskAvanceLocal[task.id])}
                                      disabled={savingAvance === task.id}
                                      className="text-[10px] font-bold px-2.5 py-1 rounded-lg text-white disabled:opacity-50"
                                      style={{ background: "oklch(0.55 0.18 260)" }}>
                                      {savingAvance === task.id ? "Guardando…" : "Guardar avance"}
                                    </button>
                                    <button onClick={() => setTaskAvanceLocal(prev => { const n = { ...prev }; delete n[task.id]; return n })}
                                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                                      Descartar
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (task.avance != null && task.avance > 0) && (
                              <div className="mt-2">
                                <div className="flex justify-between text-[10px] mb-0.5">
                                  <span className="text-muted-foreground">Avance</span>
                                  <span className="font-semibold" style={{ color: task.avance >= 100 ? "oklch(0.55 0.18 145)" : task.avance >= 50 ? "oklch(0.55 0.18 260)" : "oklch(0.60 0.18 55)" }}>
                                    {task.avance}%
                                  </span>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden bg-muted">
                                  <div className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${task.avance}%`,
                                      background: task.avance >= 100 ? "oklch(0.55 0.18 145)" : task.avance >= 50 ? "oklch(0.55 0.18 260)" : "oklch(0.60 0.18 55)",
                                    }} />
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              {task.fechaInicio && (
                                <span className="text-[11px] text-muted-foreground">
                                  Inicio: {format(new Date(task.fechaInicio + "T00:00:00"), "d 'de' MMMM, yyyy", { locale: es })}
                                </span>
                              )}
                              {task.fechaLimite && (
                                <span className={`text-[11px] font-medium ${vencida ? "text-destructive" : "text-muted-foreground"}`}>
                                  {vencida ? "⚠ Vencida · " : "Límite: "}
                                  {format(new Date(task.fechaLimite + "T00:00:00"), "d 'de' MMMM, yyyy", { locale: es })}
                                </span>
                              )}
                              <span className="text-[11px] text-muted-foreground/60">De: {task.creadoPorNombre}</span>
                            </div>

                            {/* Solicitud de plazo — admin ve el aviso */}
                            {task.solicitudPlazo && isAdmin && (
                              <div className="mt-2 px-3 py-2 rounded-lg"
                                style={{ background: "oklch(0.68 0.18 55 / 0.10)", border: "1px solid oklch(0.68 0.18 55 / 0.30)" }}>
                                <p className="text-[11px] font-bold" style={{ color: "oklch(0.58 0.20 55)" }}>
                                  ⏰ Solicitud de más tiempo · {task.solicitudPlazo.solicitadoPor}
                                </p>
                                <p className="text-[12px] text-foreground mt-0.5">{task.solicitudPlazo.motivo}</p>
                                {task.solicitudPlazo.fechaPropuesta && (
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    Fecha propuesta: {format(new Date(task.solicitudPlazo.fechaPropuesta + "T00:00:00"), "d 'de' MMMM, yyyy", { locale: es })}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Confirmación visible en la tarjeta una vez enviada */}
                            {task.solicitudPlazo && isOwn && !isAdmin && (
                              <p className="text-[11px] mt-1.5 font-medium" style={{ color: "oklch(0.58 0.20 55)" }}>
                                ⏰ Solicitud de más tiempo enviada
                              </p>
                            )}

                            {/* Archivos adjuntos de la tarea */}
                            {(isOwn || isAdmin) && (
                              <div className="mt-2 pt-2 border-t border-border">
                                <div className="flex items-center justify-between">
                                  <button
                                    onClick={() => setOpenTaskFiles(prev => { const s = new Set(prev); s.has(task.id) ? s.delete(task.id) : s.add(task.id); return s })}
                                    className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
                                    <span>Archivos</span>
                                    {(task.archivos?.length > 0) && (
                                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                                        style={{ background: "oklch(0.60 0.18 260 / 0.15)", color: "oklch(0.55 0.18 260)" }}>
                                        {task.archivos.length}
                                      </span>
                                    )}
                                    <span className="text-[9px] opacity-40">{openTaskFiles.has(task.id) ? "▲" : "▼"}</span>
                                  </button>
                                  <button
                                    onClick={() => { uploadingTaskIdRef.current = task.id; taskFileInputRef.current?.click() }}
                                    disabled={taskFileProgress !== null}
                                    className="text-[10px] font-bold px-2.5 py-1 rounded-lg text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                                    style={{ background: "oklch(0.55 0.18 260)" }}>
                                    {taskFileProgress?.taskId === task.id ? `${taskFileProgress.progress}%` : "↑ Subir"}
                                  </button>
                                </div>
                                {taskFileProgress?.taskId === task.id && (
                                  <div className="h-1 rounded-full bg-muted overflow-hidden mt-1.5">
                                    <div className="h-full rounded-full transition-all"
                                      style={{ width: `${taskFileProgress.progress}%`, background: "oklch(0.55 0.18 260)" }} />
                                  </div>
                                )}
                                {taskFileError && taskFileProgress === null && (
                                  <p className="text-[10px] text-destructive mt-1">{taskFileError}</p>
                                )}
                                {openTaskFiles.has(task.id) && (
                                  <div className="mt-1.5 space-y-1">
                                    {!task.archivos?.length ? (
                                      <p className="text-[10px] text-muted-foreground italic py-1">Sin archivos adjuntos.</p>
                                    ) : task.archivos.map((arch, ai) => {
                                      const fi = getFileTypeInfo(arch.tipo, arch.nombre)
                                      return (
                                        <div key={ai} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded flex-shrink-0"
                                            style={{ background: fi.bg, color: fi.color }}>{fi.label}</span>
                                          <span className="text-[11px] text-foreground truncate flex-1 min-w-0">{arch.nombre}</span>
                                          {arch.size && <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatFileSize(arch.size)}</span>}
                                          <a href={arch.url} target="_blank" rel="noopener noreferrer"
                                            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0" title="Descargar">↓</a>
                                          {(isAdmin || isOwn) && (
                                            <button onClick={() => handleDeleteTaskFile(task.id, arch)}
                                              className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">✕</button>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground bg-card border border-border rounded-2xl">
                <p className="text-[13px]">
                  {isAdmin ? "Sin tareas asignadas aún." : "No tienes tareas pendientes."}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Input oculto para carga de archivos por proyecto */}
        <input ref={fileInputRef} type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg"
          className="hidden" onChange={handleFileSelected} />
        {/* Input oculto para archivos de tareas */}
        <input ref={taskFileInputRef} type="file"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
          className="hidden" onChange={handleTaskFileSelected} />

      </main>
      <Footer />
    </div>
  )
}
