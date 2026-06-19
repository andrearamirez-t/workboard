import { useEffect, useState, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/services/firebase"
import { deleteColleague, deleteProject } from "@/services/colleagues.service"
import { addLog, getLogs, deleteLog, updateLog } from "@/services/logs.service"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import EmojiPicker from "emoji-picker-react"
import { Footer } from "@/components/ui/Footer"

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

function projectStatus(fechaEntrega) {
  const deadline = parseLocalDate(fechaEntrega)
  if (!deadline) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.ceil((deadline - today) / 86400000)
  if (diff < 0) return { label: "Vencido", color: "oklch(0.65 0.22 27)", bg: "oklch(0.65 0.22 27 / 0.12)" }
  if (diff === 0) return { label: "Vence hoy", color: "oklch(0.70 0.20 55)", bg: "oklch(0.70 0.20 55 / 0.12)" }
  if (diff <= 7) return { label: `${diff}d restantes`, color: "oklch(0.70 0.18 60)", bg: "oklch(0.70 0.18 60 / 0.12)" }
  return { label: `${diff}d restantes`, color: "oklch(0.60 0.18 145)", bg: "oklch(0.60 0.18 145 / 0.12)" }
}

const PROJECT_STATE_STYLE = {
  "Planificación":  { color: "oklch(0.62 0.18 260)", bg: "oklch(0.62 0.18 260 / 0.12)" },
  "En desarrollo":  { color: "oklch(0.60 0.18 290)", bg: "oklch(0.60 0.18 290 / 0.12)" },
  "En revisión":    { color: "oklch(0.68 0.18 55)",  bg: "oklch(0.68 0.18 55 / 0.12)"  },
  "Completado":     { color: "oklch(0.60 0.18 145)", bg: "oklch(0.60 0.18 145 / 0.12)" },
  "Pausado":        { color: "oklch(0.55 0.04 290)", bg: "oklch(0.55 0.04 290 / 0.12)" },
}

const VERSION_STATE_STYLE = {
  "Pendiente":  { color: "oklch(0.55 0.04 290)", bg: "oklch(0.55 0.04 290 / 0.12)" },
  "En curso":   { color: "oklch(0.62 0.18 260)", bg: "oklch(0.62 0.18 260 / 0.12)" },
  "Entregado":  { color: "oklch(0.60 0.18 145)", bg: "oklch(0.60 0.18 145 / 0.12)" },
  "Cancelado":  { color: "oklch(0.65 0.22 27)",  bg: "oklch(0.65 0.22 27 / 0.12)"  },
}

export default function ColleagueDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [companero, setCompanero] = useState(null)
  const [logs, setLogs] = useState([])
  const [nota, setNota] = useState("")
  const [saving, setSaving] = useState(false)
  const [editingLogId, setEditingLogId] = useState(null)
  const [editingLogText, setEditingLogText] = useState("")
  const [showEmoji, setShowEmoji] = useState(false)
  const notaRef = useRef(null)

  const loadData = async () => {
    const snap = await getDoc(doc(db, "companeros", id))
    if (snap.exists()) setCompanero({ id: snap.id, ...snap.data() })
    setLogs(await getLogs(id))
  }

  useEffect(() => { loadData() }, [id])

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

  if (!companero) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Cargando...</p>
    </div>
  )

  const h = hashHue(id)

  return (
    <div className="min-h-screen bg-background flex flex-col">

      <header className="bg-card border-b border-border px-8 py-4 flex justify-between items-center sticky top-0 z-10">
        <button onClick={() => navigate("/dashboard")}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Volver
        </button>
        <ThemeToggle />
      </header>

      {/* Hero */}
      <div className="relative overflow-hidden px-8 py-10"
        style={{ background: `linear-gradient(135deg, oklch(0.24 0.045 ${h}), oklch(0.22 0.04 ${(h + 25) % 360}))` }}>
        <div className="absolute inset-0 opacity-20"
          style={{ background: `radial-gradient(ellipse at top right, oklch(0.70 0.15 ${h}), transparent 60%)` }} />
        <div className="max-w-4xl mx-auto w-full relative flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-16 h-16 rounded-2xl flex-shrink-0 flex items-center justify-center text-white font-bold text-2xl"
            style={{
              background: `linear-gradient(135deg, oklch(0.65 0.16 ${h}), oklch(0.52 0.20 ${(h + 35) % 360}))`,
              boxShadow: `0 8px 24px oklch(0.55 0.18 ${h} / 40%)`,
            }}>
            {companero.nombre?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white leading-tight">{companero.nombre}</h1>
            <p className="text-sm mt-0.5" style={{ color: `oklch(0.78 0.07 ${h})` }}>
              {companero.rol || "Sin rol registrado"}
            </p>
            {companero.area && (
              <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full mt-2"
                style={{ backgroundColor: `oklch(0.30 0.06 ${h})`, color: `oklch(0.88 0.10 ${h})` }}>
                {companero.area}
              </span>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => navigate(`/colleague/${id}/edit`)}
              className="text-xs font-semibold px-4 py-2 rounded-xl border transition-all"
              style={{
                borderColor: `oklch(0.55 0.14 ${h} / 0.45)`,
                color: `oklch(0.88 0.08 ${h})`,
                backgroundColor: `oklch(0.30 0.06 ${h} / 0.30)`,
              }}>
              Editar
            </button>
            <button onClick={handleDelete}
              className="text-xs font-semibold px-4 py-2 rounded-xl text-white transition-all hover:opacity-80"
              style={{ backgroundColor: "oklch(0.50 0.20 27)" }}>
              Eliminar
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-8 py-8 w-full flex-1 space-y-8">

        {/* Info principal */}
        {(companero.trabajaEn || companero.herramientas?.length > 0 || companero.notas) && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden"
            style={{ borderLeftColor: `oklch(0.60 0.18 ${h})`, borderLeftWidth: "4px" }}>
            <div className="p-6 space-y-4">
              {companero.trabajaEn && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Trabajando en</p>
                  <p className="text-sm text-foreground leading-relaxed">{companero.trabajaEn}</p>
                </div>
              )}
              {companero.herramientas?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Herramientas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {companero.herramientas.map(tool => (
                      <span key={tool} className="text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{ backgroundColor: `oklch(0.32 0.045 ${h})`, color: `oklch(0.82 0.08 ${h})` }}>
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {companero.notas && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notas</p>
                  <p className="text-sm text-foreground leading-relaxed">{companero.notas}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Proyectos */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-foreground">Proyectos</h2>
            <Button size="sm" onClick={() => navigate(`/colleague/${id}/project/new`)}>+ Agregar proyecto</Button>
          </div>
          {companero.proyectos?.length > 0 ? (
            <div className="space-y-3">
              {companero.proyectos.map((proyecto, index) => {
                const pH = (h + index * 55) % 360
                return (
                  <div key={index} className="bg-card border border-border rounded-2xl overflow-hidden group"
                    style={{ borderLeftColor: `oklch(0.60 0.16 ${pH})`, borderLeftWidth: "4px" }}>
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-foreground text-base">{proyecto.nombre}</h3>
                            {proyecto.estado && PROJECT_STATE_STYLE[proyecto.estado] && (
                              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                                style={{ color: PROJECT_STATE_STYLE[proyecto.estado].color, backgroundColor: PROJECT_STATE_STYLE[proyecto.estado].bg }}>
                                {proyecto.estado}
                              </span>
                            )}
                          </div>
                          {proyecto.area && (
                            <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-1"
                              style={{ backgroundColor: `oklch(0.34 0.06 ${pH})`, color: `oklch(0.85 0.10 ${pH})` }}>
                              {proyecto.area}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => navigate(`/colleague/${id}/project/new`, { state: { editProject: proyecto } })}
                            className="text-xs font-medium hover:opacity-70"
                            style={{ color: `oklch(0.65 0.14 ${pH})` }}>
                            Editar
                          </button>
                          <button onClick={() => handleDeleteProject(proyecto)}
                            className="text-xs text-destructive hover:opacity-70">
                            Eliminar
                          </button>
                        </div>
                      </div>
                      {proyecto.queHace && (
                        <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
                          <span className="font-semibold text-foreground">Qué hace: </span>{proyecto.queHace}
                        </p>
                      )}
                      {proyecto.herramientas?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {proyecto.herramientas.map(tool => (
                            <span key={tool} className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                              style={{ backgroundColor: `oklch(0.32 0.04 ${pH})`, color: `oklch(0.82 0.08 ${pH})` }}>
                              {tool}
                            </span>
                          ))}
                        </div>
                      )}
                      {proyecto.observaciones && (
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          <span className="font-semibold text-foreground">Observaciones: </span>{proyecto.observaciones}
                        </p>
                      )}

                      {/* Timeline de fechas */}
                      {(proyecto.fechaInicio || proyecto.fechaEntrega || proyecto.versiones?.length > 0) && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                            {proyecto.fechaInicio && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground">Inicio:</span>
                                <span className="text-xs font-medium text-foreground">
                                  {format(parseLocalDate(proyecto.fechaInicio), "d MMM yyyy", { locale: es })}
                                </span>
                              </div>
                            )}
                            {proyecto.fechaEntrega && (() => {
                              const st = projectStatus(proyecto.fechaEntrega)
                              return (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs text-muted-foreground">Entrega:</span>
                                  <span className="text-xs font-medium text-foreground">
                                    {format(parseLocalDate(proyecto.fechaEntrega), "d MMM yyyy", { locale: es })}
                                  </span>
                                  {st && (
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                      style={{ color: st.color, backgroundColor: st.bg }}>
                                      {st.label}
                                    </span>
                                  )}
                                </div>
                              )
                            })()}
                          </div>
                          {proyecto.versiones?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {proyecto.versiones.map((v, vi) => {
                                const vStyle = v.estado ? VERSION_STATE_STYLE[v.estado] : null
                                return (
                                  <span key={vi} className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground flex items-center gap-1.5"
                                    style={vStyle ? { borderColor: vStyle.color + "55", backgroundColor: vStyle.bg } : {}}>
                                    <span className="font-semibold" style={{ color: vStyle ? vStyle.color : `oklch(0.72 0.12 ${pH})` }}>{v.nombre}</span>
                                    {v.fecha && <span className="opacity-70">— {format(parseLocalDate(v.fecha), "d MMM", { locale: es })}</span>}
                                    {v.estado && <span className="font-bold" style={{ color: vStyle?.color }}>· {v.estado}</span>}
                                  </span>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground bg-card border border-border rounded-2xl">
              <p className="text-sm">Sin proyectos registrados.</p>
            </div>
          )}
        </div>

        {/* Bitácora */}
        <div>
          <h2 className="text-lg font-bold text-foreground mb-4">Bitácora</h2>

          <form onSubmit={handleAddLog}
            className="bg-card border border-border rounded-2xl p-5 mb-4"
            style={{ borderTopColor: `oklch(0.60 0.16 ${h})`, borderTopWidth: "3px" }}>
            <div className="flex justify-end mb-2">
              <button type="button" onClick={() => setShowEmoji(v => !v)}
                className="text-lg leading-none hover:scale-110 transition-transform" title="Insertar emoji">
                😊
              </button>
            </div>
            {showEmoji && (
              <div className="mb-3">
                <EmojiPicker onEmojiClick={handleEmojiClick} width="100%" height={350}
                  searchPlaceholder="Buscar emoji..." skinTonesDisabled
                  previewConfig={{ showPreview: false }} />
              </div>
            )}
            <textarea ref={notaRef} value={nota} onChange={e => setNota(e.target.value)}
              placeholder="¿Qué está haciendo esta semana?"
              rows={3}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground mb-3 focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
            <button type="submit" disabled={saving}
              className="text-sm font-semibold px-5 py-2 rounded-xl text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, oklch(0.58 0.18 ${h}), oklch(0.52 0.20 ${(h + 25) % 360}))` }}>
              {saving ? "Guardando..." : "Guardar nota"}
            </button>
          </form>

          {logs.length > 0 ? (
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="bg-card border border-border rounded-xl p-4 group">
                  {editingLogId === log.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingLogText}
                        onChange={e => setEditingLogText(e.target.value)}
                        rows={3}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => handleSaveEditLog(log.id)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
                          style={{ backgroundColor: `oklch(0.55 0.16 ${h})` }}>
                          Guardar
                        </button>
                        <button onClick={() => setEditingLogId(null)}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                        style={{ backgroundColor: `oklch(0.62 0.16 ${h})` }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground leading-relaxed">{log.nota}</p>
                        <div className="flex justify-between items-center mt-1.5">
                          <p className="text-xs text-muted-foreground capitalize">
                            {log.createdAt?.toDate
                              ? format(log.createdAt.toDate(), "EEEE d 'de' MMMM, yyyy", { locale: es })
                              : ""}
                          </p>
                          <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleStartEditLog(log)}
                              className="text-xs font-medium hover:opacity-70"
                              style={{ color: `oklch(0.65 0.14 ${h})` }}>
                              Editar
                            </button>
                            <button onClick={() => handleDeleteLog(log.id)}
                              className="text-xs text-destructive hover:opacity-70">
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground bg-card border border-border rounded-2xl">
              <p className="text-sm">Sin notas aún. Agrega la primera.</p>
            </div>
          )}
        </div>

      </main>
      <Footer />
    </div>
  )
}
