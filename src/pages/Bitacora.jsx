import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { getAllLogs, deleteLog, updateLog } from "@/services/logs.service"
import { getColleagues } from "@/services/colleagues.service"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { Footer } from "@/components/ui/Footer"
import { format, startOfWeek, endOfWeek, isWithinInterval } from "date-fns"
import { es } from "date-fns/locale"

function hashHue(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return Math.abs(h * 137.508) % 360
}

export default function Bitacora() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [logs, setLogs] = useState([])
  const [colleagueMap, setColleagueMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editingText, setEditingText] = useState("")

  const load = async () => {
    const [allLogs, colleagues] = await Promise.all([
      getAllLogs(user.uid),
      getColleagues(user),
    ])
    const map = {}
    colleagues.forEach(c => { map[c.id] = c })
    setColleagueMap(map)
    setLogs(allLogs)
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const handleDeleteLog = async (logId) => {
    if (!confirm("¿Eliminar esta nota?")) return
    await deleteLog(logId)
    setLogs(prev => prev.filter(l => l.id !== logId))
  }

  const handleSaveEdit = async (logId) => {
    if (!editingText.trim()) return
    await updateLog(logId, editingText.trim())
    setLogs(prev => prev.map(l => l.id === logId ? { ...l, nota: editingText.trim() } : l))
    setEditingId(null)
  }

  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })

  const thisWeek = logs.filter(log => {
    if (!log.createdAt?.toDate) return false
    if (!colleagueMap[log.colleagueId]) return false
    return isWithinInterval(log.createdAt.toDate(), { start: weekStart, end: weekEnd })
  })

  const grouped = thisWeek.reduce((acc, log) => {
    if (!acc[log.colleagueId]) acc[log.colleagueId] = { name: log.colleagueName, logs: [] }
    acc[log.colleagueId].logs.push(log)
    return acc
  }, {})

  const totalNotas = thisWeek.length
  const totalPersonas = Object.keys(grouped).length

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border px-8 py-4 flex justify-between items-center sticky top-0 z-10">
        <button onClick={() => navigate("/dashboard")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Volver</button>
        <ThemeToggle />
      </header>

      {/* Hero de la página */}
      <div className="relative overflow-hidden px-8 py-10"
        style={{ background: "linear-gradient(135deg, oklch(0.24 0.045 290), oklch(0.22 0.04 320))" }}>
        <div className="absolute inset-0 opacity-20"
          style={{ background: "radial-gradient(ellipse at top right, oklch(0.72 0.13 290), transparent 60%)" }} />
        <div className="max-w-4xl mx-auto w-full relative">
          <h1 className="text-3xl font-bold text-white mb-1">Bitácora semanal</h1>
          <p className="text-sm mb-4" style={{ color: "oklch(0.80 0.06 290)" }}>
            {format(weekStart, "d 'de' MMMM", { locale: es })} — {format(weekEnd, "d 'de' MMMM, yyyy", { locale: es })}
          </p>
          <div className="flex gap-4">
            <div className="rounded-xl px-4 py-2 text-sm font-medium"
              style={{ backgroundColor: "oklch(0.30 0.05 290)", color: "oklch(0.85 0.08 290)" }}>
              {totalNotas} nota{totalNotas !== 1 ? "s" : ""} esta semana
            </div>
            <div className="rounded-xl px-4 py-2 text-sm font-medium"
              style={{ backgroundColor: "oklch(0.30 0.05 290)", color: "oklch(0.85 0.08 290)" }}>
              {totalPersonas} compañero{totalPersonas !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </div>

      <main className="px-8 py-8 max-w-4xl mx-auto w-full flex-1">
        {loading ? (
          <p className="text-muted-foreground">Cargando...</p>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium mb-1">Sin notas esta semana</p>
            <p className="text-sm">Ve al perfil de un compañero y agrega una nota.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([colleagueId, data]) => {
              const h = hashHue(colleagueId)
              const initials = data.name.charAt(0).toUpperCase()
              return (
                <div key={colleagueId} className="bg-card rounded-2xl border border-border overflow-hidden"
                  style={{ borderLeftColor: `oklch(0.60 0.18 ${h})`, borderLeftWidth: "4px" }}>

                  {/* Cabecera del compañero */}
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-border cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => navigate(`/colleague/${colleagueId}`)}>
                    <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm"
                      style={{ background: `linear-gradient(135deg, oklch(0.65 0.16 ${h}), oklch(0.55 0.18 ${(h + 30) % 360}))` }}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">{data.name}</p>
                      {colleagueMap[colleagueId]?.area && (
                        <p className="text-xs text-muted-foreground">{colleagueMap[colleagueId].area}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground"
                      style={{ color: `oklch(0.60 0.12 ${h})` }}>
                      {data.logs.length} nota{data.logs.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Notas */}
                  <div className="divide-y divide-border">
                    {data.logs.map((log) => (
                      <div key={log.id} className="px-5 py-3 group">
                        <div className="flex gap-3 items-start">
                          <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                            style={{ backgroundColor: `oklch(0.60 0.16 ${h})` }} />
                          <div className="flex-1 min-w-0">
                            {editingId === log.id ? (
                              <div className="space-y-2">
                                <textarea
                                  value={editingText}
                                  onChange={e => setEditingText(e.target.value)}
                                  rows={3}
                                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                />
                                <div className="flex gap-2">
                                  <button onClick={() => handleSaveEdit(log.id)}
                                    className="text-xs font-medium px-3 py-1 rounded-md text-white"
                                    style={{ backgroundColor: `oklch(0.55 0.16 ${h})` }}>
                                    Guardar
                                  </button>
                                  <button onClick={() => setEditingId(null)}
                                    className="text-xs font-medium px-3 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground">
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-sm text-foreground leading-relaxed">{log.nota}</p>
                                <div className="flex justify-between items-center mt-1">
                                  <p className="text-xs text-muted-foreground capitalize">
                                    {log.createdAt?.toDate ? format(log.createdAt.toDate(), "EEEE d 'de' MMMM", { locale: es }) : ""}
                                  </p>
                                  <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => { setEditingId(log.id); setEditingText(log.nota) }}
                                      className="text-xs font-medium hover:opacity-70"
                                      style={{ color: `oklch(0.60 0.14 ${h})` }}>
                                      Editar
                                    </button>
                                    <button onClick={() => handleDeleteLog(log.id)}
                                      className="text-xs text-destructive hover:opacity-70">
                                      Eliminar
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
