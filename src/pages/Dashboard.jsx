import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { getColleagues } from "@/services/colleagues.service"
import { getAllLogs } from "@/services/logs.service"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { Footer } from "@/components/ui/Footer"
import { UserCircle, Search, Users, BarChart2, Plus, Pencil, Trash2, X } from "lucide-react"
import { NotificationBell } from "@/components/ui/NotificationBell"
import { Tutorial, resetTutorial } from "@/components/ui/Tutorial"
import { MetricsDashboard } from "@/components/ui/MetricsDashboard"
import { TeamDashboard } from "@/components/ui/TeamDashboard"
import { getEquipos, createEquipo, updateEquipo, deleteEquipo } from "@/services/equipos.service"
import { queueGrupoNotification } from "@/services/wpp.service"

const ADMIN_EMAILS = ["andrea_ramirezt@cun.edu.co", "angela_bernalm@cun.edu.co", "jose_forero@cun.edu.co"]

function hashHue(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return Math.abs(h * 137.508) % 360
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, logout, myColleagueId } = useAuth()
  const isAdmin = ADMIN_EMAILS.includes(user?.email)
  const [colleagues, setColleagues] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [search, setSearch] = useState("")
  const [hoveredId, setHoveredId] = useState(null)
  const [showTutorial, setShowTutorial] = useState(false)
  const [tab, setTab] = useState("equipo") // "resumen" | "equipo" | "equipos" | "metricas"
  const [logs, setLogs] = useState([])
  // Equipos state
  const [equipos, setEquipos] = useState([])
  const [equipoForm, setEquipoForm] = useState({ nombre: "", descripcion: "", color: "295" })
  const [showEquipoForm, setShowEquipoForm] = useState(false)
  const [editingEquipo, setEditingEquipo] = useState(null)
  const [savingEquipo, setSavingEquipo] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoadingData(true)
    Promise.all([getColleagues(), getAllLogs(), getEquipos().catch(() => [])]).then(([cols, ls, eqs]) => {
      setColleagues(cols)
      setLogs(ls)
      setEquipos(eqs)
      setLoadingData(false)
    })
  }, [user])

  const reloadEquipos = () => getEquipos().then(setEquipos)

  const handleSaveEquipo = async () => {
    if (!equipoForm.nombre.trim()) return
    setSavingEquipo(true)
    try {
      if (editingEquipo) {
        await updateEquipo(editingEquipo.id, { nombre: equipoForm.nombre.trim(), descripcion: equipoForm.descripcion.trim(), color: equipoForm.color })
      } else {
        await createEquipo({
          nombre: equipoForm.nombre.trim(),
          descripcion: equipoForm.descripcion.trim(),
          color: equipoForm.color,
          miembros: myColleagueId ? [myColleagueId] : [],
          memberUids: user?.uid ? [user.uid] : [],
        })
      }
      await reloadEquipos()
      setShowEquipoForm(false)
      setEditingEquipo(null)
      setEquipoForm({ nombre: "", descripcion: "", color: "295" })
    } catch (e) {
      console.error("Error guardando equipo:", e)
    } finally {
      setSavingEquipo(false)
    }
  }

  const handleDeleteEquipo = async (id) => {
    try { await deleteEquipo(id) } catch (e) { console.error(e) }
    reloadEquipos().catch(() => {})
  }

  const handleToggleMember = async (equipoId, colleagueId) => {
    const eq = equipos.find(e => e.id === equipoId)
    if (!eq) return
    const miembros = eq.miembros || []
    const memberUids = eq.memberUids || []
    const colleague = colleagues.find(c => c.id === colleagueId)
    const adding = !miembros.includes(colleagueId)
    const updatedMiembros = adding ? [...miembros, colleagueId] : miembros.filter(m => m !== colleagueId)
    const uid = colleague?.uid
    const updatedUids = uid
      ? (adding ? [...memberUids, uid] : memberUids.filter(u => u !== uid))
      : memberUids
    try {
      await updateEquipo(equipoId, { miembros: updatedMiembros, memberUids: updatedUids })
      if (adding && colleague?.whatsapp) {
        queueGrupoNotification({ colleague, grupo: eq }).catch(() => {})
      }
    } catch (e) { console.error(e) }
    reloadEquipos().catch(() => {})
  }

  // Map colleagueId → equipo nombre for badge
  const colleagueEquipoMap = {}
  equipos.forEach(eq => (eq.miembros || []).forEach(cid => { colleagueEquipoMap[cid] = eq }))

  const COLORS = ["295", "260", "145", "55", "27", "316", "180", "220"]

  const totalProjects = colleagues.reduce((sum, c) => sum + (c.proyectos?.length || 0), 0)
  const totalTools = new Set(colleagues.flatMap(c => c.herramientas || [])).size

  const filtered = colleagues
    .filter(c => {
      const q = search.toLowerCase()
      return !q ||
        c.nombre?.toLowerCase().includes(q) ||
        c.rol?.toLowerCase().includes(q) ||
        c.herramientas?.some(t => t.toLowerCase().includes(q)) ||
        c.area?.toLowerCase().includes(q)
    })
    .sort((a, b) => (b.id === myColleagueId ? 1 : 0) - (a.id === myColleagueId ? 1 : 0))

  const userInitial = user?.displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "?"

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-border/60 px-6 py-3 flex justify-between items-center"
        style={{ backgroundColor: "color-mix(in srgb, var(--background) 82%, transparent)", backdropFilter: "blur(20px)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold select-none"
            style={{ background: "linear-gradient(140deg, oklch(0.60 0.24 295), oklch(0.50 0.26 316))", boxShadow: "0 2px 8px oklch(0.52 0.24 295 / 35%)" }}>
            W
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-foreground">Workboard</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span data-tour="bell">
            <NotificationBell isAdmin={isAdmin} myColleagueId={myColleagueId} userEmail={user?.email} userUid={user?.uid} />
          </span>
          <ThemeToggle />
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold select-none cursor-default"
            style={{ background: "linear-gradient(135deg, oklch(0.62 0.22 295), oklch(0.50 0.24 316))", boxShadow: "0 2px 6px oklch(0.52 0.22 295 / 30%)" }}
            title={user?.displayName || user?.email}>
            {userInitial}
          </div>
          <button
            onClick={() => { resetTutorial(user?.email); setShowTutorial(true) }}
            className="w-7 h-7 flex items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors text-[12px] font-bold"
            title="Ver tutorial">
            ?
          </button>
          <Button variant="outline" size="sm" onClick={logout} className="text-[13px] h-8">
            Salir
          </Button>
        </div>
      </header>

      <main className="px-6 py-8 max-w-6xl mx-auto w-full flex-1">

        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
          <div>
            <h2 className="text-[30px] font-bold tracking-tight text-foreground leading-none">
              {tab === "resumen" ? "Resumen del equipo" : tab === "equipo" ? "Mi equipo" : tab === "equipos" ? "Grupos" : "Análisis & Reportes"}
            </h2>
            <p className="text-[13px] text-muted-foreground mt-1.5">
              Investigación e innovación · {colleagues.length} persona{colleagues.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && tab === "equipo" && (
              <Button size="sm" className="h-8 text-[13px]" onClick={() => navigate("/colleague/new")}>
                + Compañero
              </Button>
            )}
            {tab === "equipos" && (
              <Button size="sm" className="h-8 text-[13px]"
                onClick={() => { setEditingEquipo(null); setEquipoForm({ nombre: "", descripcion: "", color: "295" }); setShowEquipoForm(true) }}>
                <Plus size={13} className="mr-1" /> Nuevo grupo
              </Button>
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {[
            ...(isAdmin ? [
              { key: "resumen", label: "Resumen", icon: <BarChart2 size={14} /> },
            ] : []),
            { key: "equipo", label: "Mi equipo", icon: <UserCircle size={14} /> },
            { key: "equipos", label: "Grupos", icon: <Users size={14} /> },
            ...(isAdmin ? [
              { key: "metricas", label: "Análisis", icon: <BarChart2 size={14} /> },
            ] : []),
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium transition-all border-b-2 -mb-px"
              style={{
                borderColor: tab === t.key ? "oklch(0.62 0.22 295)" : "transparent",
                color: tab === t.key ? "oklch(0.62 0.22 295)" : "var(--muted-foreground)",
              }}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* ══ TAB: RESUMEN (solo admin) ═══════════════════════════════════ */}
        {isAdmin && tab === "resumen" && (
          <TeamDashboard colleagues={colleagues} logs={logs} />
        )}

        {/* ══ TAB: MI EQUIPO ══════════════════════════════════════════════ */}
        {tab === "equipo" && <>

        {/* ── Stats strip skeleton ── */}
        {loadingData && (
          <div className="grid grid-cols-3 gap-3 mb-7">
            {[0, 1, 2].map(i => (
              <div key={i} className="rounded-2xl border border-border px-5 py-4 animate-pulse bg-card">
                <div className="h-8 w-10 rounded-lg bg-muted mb-2" />
                <div className="h-3 w-20 rounded bg-muted mb-1.5" />
                <div className="h-2.5 w-16 rounded bg-muted" />
              </div>
            ))}
          </div>
        )}

        {/* ── Stats strip ── */}
        {!loadingData && colleagues.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-7">
            {[
              { value: colleagues.length, label: "Personas", sub: "en el equipo" },
              { value: totalProjects, label: "Proyectos", sub: "registrados" },
              { value: totalTools, label: "Herramientas", sub: "en uso" },
            ].map((stat, i) => {
              const statHue = [295, 260, 180][i]
              return (
                <div key={stat.label} className="relative overflow-hidden rounded-2xl border border-border px-5 py-4"
                  style={{
                    background: `linear-gradient(135deg, var(--card), oklch(0.60 0.14 ${statHue} / 0.06))`,
                    boxShadow: "0 2px 12px oklch(0 0 0 / 6%)",
                  }}>
                  <div className="absolute top-0 right-0 w-20 h-20 pointer-events-none opacity-20"
                    style={{ background: `radial-gradient(circle at top right, oklch(0.65 0.18 ${statHue}), transparent 70%)`, filter: "blur(20px)" }} />
                  <p className="text-[32px] font-bold text-foreground leading-none">{stat.value}</p>
                  <p className="text-[13px] font-semibold text-foreground mt-1">{stat.label}</p>
                  <p className="text-[11px] text-muted-foreground">{stat.sub}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Search ── */}
        {!loadingData && colleagues.length > 0 && (
          <div className="relative mb-4" data-tour="search">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nombre, rol, herramienta o enfoque…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-10 bg-card border border-border rounded-xl pl-9 pr-4 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/30 transition-all"
            />
          </div>
        )}


        {/* ── States ── */}
        {loadingData ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} className="rounded-2xl border border-border bg-card p-5 animate-pulse">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-muted flex-shrink-0" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-3.5 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="h-3 bg-muted rounded w-full" />
                  <div className="h-3 bg-muted rounded w-4/5" />
                </div>
                <div className="flex gap-1.5 mb-4">
                  <div className="h-5 w-14 bg-muted rounded-md" />
                  <div className="h-5 w-16 bg-muted rounded-md" />
                  <div className="h-5 w-12 bg-muted rounded-md" />
                </div>
                <div className="pt-3 border-t border-border flex justify-between">
                  <div className="h-3 w-20 bg-muted rounded" />
                  <div className="h-3 w-16 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : colleagues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-muted-foreground animate-fade-up">
            <div className="w-14 h-14 rounded-2xl mb-4 flex items-center justify-center"
              style={{ background: "oklch(0.52 0.24 295 / 0.10)" }}>
              <UserCircle size={26} style={{ color: "oklch(0.52 0.24 295)" }} />
            </div>
            <p className="font-semibold text-foreground text-[15px]">Sin compañeros aún</p>
            <p className="text-[13px] mt-1">Agrega el primero para empezar.</p>
            {isAdmin && (
              <Button size="sm" className="mt-5" onClick={() => navigate("/colleague/new")}>
                + Agregar compañero
              </Button>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-[15px] font-semibold text-foreground mb-1">Sin resultados</p>
            <p className="text-[13px]">Intenta con otro término o enfoque.</p>
          </div>
        ) : (

          /* ── Cards grid ── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-tour="cards">
            {filtered.map((c) => {
              const h = c.colorHue ?? hashHue(c.id)
              const isHovered = hoveredId === c.id
              return (
                <a key={c.id} href={`/colleague/${c.id}`}
                  className="group block rounded-2xl overflow-hidden cursor-pointer relative"
                  onMouseEnter={() => setHoveredId(c.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    background: `linear-gradient(150deg, var(--card), oklch(0.60 0.14 ${h} / 0.06))`,
                    border: "1px solid var(--border)",
                    borderLeft: `3px solid oklch(0.62 0.18 ${h})`,
                    transition: "transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.22s ease",
                    transform: isHovered ? "translateY(-4px)" : "translateY(0)",
                    boxShadow: isHovered
                      ? `0 24px 60px oklch(0.55 0.18 ${h} / 20%), 0 8px 24px oklch(0 0 0 / 14%), 0 0 0 1px oklch(0.62 0.18 ${h} / 14%)`
                      : "0 2px 10px oklch(0 0 0 / 7%)",
                  }}>

                  {/* Top glow on hover */}
                  <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: `radial-gradient(ellipse at 60% -10%, oklch(0.68 0.18 ${h} / 0.10), transparent 65%)` }} />

                  <div className="p-5 space-y-3.5 relative">

                    {/* Avatar + Name + Role */}
                    <div className="flex items-start gap-3">
                      <div className="relative flex-shrink-0">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-[16px] overflow-hidden"
                          style={{ background: c.avatarUrl ? "var(--muted)" : `linear-gradient(135deg, oklch(0.68 0.18 ${h}), oklch(0.54 0.22 ${(h + 40) % 360}))` }}>
                          {c.avatarUrl
                            ? <img src={c.avatarUrl} alt={c.nombre} className="w-full h-full object-cover" />
                            : c.avatarEmoji
                              ? <span className="text-xl leading-none">{c.avatarEmoji}</span>
                              : c.nombre?.charAt(0).toUpperCase()
                          }
                        </div>
                        <div className="absolute -inset-1.5 rounded-xl -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          style={{ background: `oklch(0.62 0.18 ${h} / 0.28)`, filter: "blur(10px)" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-[15px] text-foreground leading-tight">{c.nombre}</p>
                          {c.id === myColleagueId && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 tracking-wide"
                              style={{ backgroundColor: "oklch(0.52 0.24 295 / 0.15)", color: "oklch(0.62 0.22 295)" }}>
                              TÚ
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{c.rol || "Sin rol"}</p>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {c.area && (
                            <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full leading-4"
                              style={{ backgroundColor: `oklch(0.60 0.18 ${h} / 0.13)`, color: `oklch(0.50 0.20 ${h})` }}>
                              {c.area}
                            </span>
                          )}
                          {colleagueEquipoMap[c.id] && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full leading-4"
                              style={{
                                backgroundColor: `oklch(0.62 0.22 ${colleagueEquipoMap[c.id].color || "295"} / 0.13)`,
                                color: `oklch(0.52 0.22 ${colleagueEquipoMap[c.id].color || "295"})`,
                              }}>
                              <Users size={9} />
                              {colleagueEquipoMap[c.id].nombre}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Working on */}
                    {c.trabajaEn && (
                      <p className="text-[12.5px] text-muted-foreground line-clamp-2 leading-relaxed">{c.trabajaEn}</p>
                    )}

                    {/* Tools */}
                    {c.herramientas?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {c.herramientas.slice(0, 4).map(tool => (
                          <span key={tool} className="text-[11px] px-2 py-0.5 rounded-md font-medium"
                            style={{ backgroundColor: `oklch(0.60 0.10 ${h} / 0.10)`, color: `oklch(0.62 0.12 ${h})` }}>
                            {tool}
                          </span>
                        ))}
                        {c.herramientas.length > 4 && (
                          <span className="text-[11px] px-1.5 py-0.5 text-muted-foreground">
                            +{c.herramientas.length - 4}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Card footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <div className="flex items-center gap-2">
                        {/* Project dots */}
                        <div className="flex gap-0.5 items-center">
                          {(c.proyectos?.length || 0) === 0 ? (
                            <div className="w-2 h-2 rounded-full bg-border" />
                          ) : (
                            Array.from({ length: Math.min(c.proyectos.length, 5) }).map((_, i) => (
                              <div key={i} className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: `oklch(0.60 0.18 ${h} / ${i === 0 ? 0.9 : 0.35})` }} />
                            ))
                          )}
                          {(c.proyectos?.length || 0) > 5 && (
                            <span className="text-[10px] text-muted-foreground ml-0.5">+{c.proyectos.length - 5}</span>
                          )}
                        </div>
                        <span className="text-[11.5px] text-muted-foreground">
                          {c.proyectos?.length || 0} proyecto{c.proyectos?.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <span className="text-[12px] font-semibold text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-0.5">
                        Ver perfil
                        <span className="inline-block transition-transform duration-150 group-hover:translate-x-0.5 ml-0.5">→</span>
                      </span>
                    </div>

                  </div>
                </a>
              )
            })}
          </div>
        )}

        </> /* fin tab equipo */}

        {/* ══ TAB: MÉTRICAS ════════════════════════════════════════════════ */}
        {tab === "metricas" && (
          <MetricsDashboard colleagues={colleagues} logs={logs} />
        )}

        {/* ══ TAB: GRUPOS ══════════════════════════════════════════════════ */}
        {tab === "equipos" && (
          <div className="space-y-4">

            {/* Formulario crear nuevo grupo */}
            {showEquipoForm && !editingEquipo && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <p className="text-[13px] font-semibold text-foreground">Nuevo grupo</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input placeholder="Nombre del grupo *" value={equipoForm.nombre}
                    onChange={e => setEquipoForm(f => ({ ...f, nombre: e.target.value }))}
                    className="bg-muted/50 border border-border rounded-xl px-4 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40" />
                  <input placeholder="Descripción (opcional)" value={equipoForm.descripcion}
                    onChange={e => setEquipoForm(f => ({ ...f, descripcion: e.target.value }))}
                    className="bg-muted/50 border border-border rounded-xl px-4 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40" />
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-[12px] text-muted-foreground">Color:</p>
                  {["295", "27", "145", "55", "316", "180"].map(hue => (
                    <button key={hue} onClick={() => setEquipoForm(f => ({ ...f, color: hue }))}
                      className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                      style={{ background: `oklch(0.62 0.22 ${hue})`, outline: equipoForm.color === hue ? `2px solid oklch(0.62 0.22 ${hue})` : "none", outlineOffset: 2 }} />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveEquipo} disabled={savingEquipo}>
                    {savingEquipo ? "Guardando…" : "Crear grupo"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowEquipoForm(false)}>Cancelar</Button>
                </div>
              </div>
            )}

            {/* Formulario editar grupo (panel separado arriba) */}
            {editingEquipo && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4"
                style={{ borderLeft: `3px solid oklch(0.62 0.22 ${equipoForm.color || "295"})` }}>
                <p className="text-[13px] font-semibold text-foreground">Editando: {editingEquipo.nombre}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input placeholder="Nombre *" value={equipoForm.nombre}
                    onChange={e => setEquipoForm(f => ({ ...f, nombre: e.target.value }))}
                    className="bg-muted/50 border border-border rounded-xl px-4 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40" />
                  <input placeholder="Descripción (opcional)" value={equipoForm.descripcion}
                    onChange={e => setEquipoForm(f => ({ ...f, descripcion: e.target.value }))}
                    className="bg-muted/50 border border-border rounded-xl px-4 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40" />
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-[12px] text-muted-foreground">Color:</p>
                  {["295", "27", "145", "55", "316", "180"].map(hue => (
                    <button key={hue} onClick={() => setEquipoForm(f => ({ ...f, color: hue }))}
                      className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                      style={{ background: `oklch(0.62 0.22 ${hue})`, outline: equipoForm.color === hue ? `2px solid oklch(0.62 0.22 ${hue})` : "none", outlineOffset: 2 }} />
                  ))}
                </div>

                {/* Lista unificada: todos los compañeros, toggleable */}
                {(() => {
                  const liveEquipo = equipos.find(e => e.id === editingEquipo.id) || editingEquipo
                  const memberIds = new Set(liveEquipo.miembros || [])
                  const memberCount = colleagues.filter(c => memberIds.has(c.id)).length
                  return (
                    <div>
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                        Compañeros — {memberCount} en el grupo
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {colleagues.map(c => {
                          const ch = c.colorHue ?? hashHue(c.id)
                          const isMember = memberIds.has(c.id)
                          return (
                            <button key={c.id}
                              onClick={() => handleToggleMember(editingEquipo.id, c.id)}
                              title={isMember ? `Quitar a ${c.nombre}` : `Agregar a ${c.nombre}`}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] border transition-all"
                              style={isMember ? {
                                borderColor: `oklch(0.62 0.18 ${ch})`,
                                background: `oklch(0.62 0.18 ${ch} / 0.12)`,
                                color: "var(--foreground)",
                              } : {
                                borderColor: "var(--border)",
                                background: "transparent",
                                color: "var(--muted-foreground)",
                              }}>
                              <div className="w-5 h-5 rounded flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 overflow-hidden"
                                style={{ background: c.avatarUrl ? "var(--muted)" : `oklch(0.68 0.18 ${ch})` }}>
                                {c.avatarUrl
                                  ? <img src={c.avatarUrl} alt={c.nombre} className="w-full h-full object-cover" />
                                  : c.avatarEmoji
                                    ? <span className="text-xs leading-none">{c.avatarEmoji}</span>
                                    : c.nombre?.charAt(0).toUpperCase()
                                }
                              </div>
                              <span className="font-medium">{c.nombre?.split(" ").slice(0,2).join(" ")}</span>
                              {c.rol && <span className="text-[10px] opacity-50">· {c.rol.split(" ")[0]}</span>}
                              {isMember
                                ? <X size={11} className="ml-0.5 flex-shrink-0" style={{ color: "oklch(0.60 0.18 27)" }} />
                                : <Plus size={10} className="ml-0.5 opacity-40 flex-shrink-0" />
                              }
                            </button>
                          )
                        })}
                      </div>
                    </div>
                   )
                })()}

                <div className="flex gap-2 pt-1 border-t border-border">
                  <Button size="sm" onClick={handleSaveEquipo} disabled={savingEquipo}>
                    {savingEquipo ? "Guardando…" : "Guardar cambios"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingEquipo(null)}>Cancelar</Button>
                </div>
              </div>
            )}

            {/* Grid de grupos — estilo Mi equipo */}
            {(() => {
              const visibleEquipos = isAdmin
                ? equipos
                : equipos.filter(eq => eq.memberUids?.includes(user?.uid))
              const emptyMsg = isAdmin ? "Crea el primero con el botón de arriba." : "Pídele al admin o a un compañero que te agregue."
              return visibleEquipos.length === 0 && !showEquipoForm && !editingEquipo ? (
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                <Users size={32} className="mb-3 opacity-30" />
                <p className="font-semibold text-foreground text-[15px]">Sin grupos</p>
                <p className="text-[13px] mt-1">{emptyMsg}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleEquipos.map(eq => {
                  const eqColor = eq.color || "295"
                  const miembros = (eq.miembros || []).map(cid => colleagues.find(c => c.id === cid)).filter(Boolean)
                  const isActive = editingEquipo?.id === eq.id
                  return (
                    <div key={eq.id}
                      className="relative rounded-2xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => navigate(`/grupo/${eq.id}`)}
                      style={{
                        background: `linear-gradient(150deg, var(--card), oklch(0.60 0.14 ${eqColor} / 0.06))`,
                        border: "1px solid var(--border)",
                        borderLeft: `3px solid oklch(0.62 0.18 ${eqColor})`,
                        boxShadow: isActive ? `0 0 0 2px oklch(0.62 0.22 ${eqColor} / 40%)` : "0 2px 10px oklch(0 0 0 / 7%)",
                      }}>
                      <div className="p-5">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ background: `oklch(0.62 0.22 ${eqColor})` }} />
                              <h3 className="font-bold text-foreground text-[15px] truncate">{eq.nombre}</h3>
                            </div>
                            {eq.descripcion && (
                              <p className="text-[12px] text-muted-foreground ml-4 truncate">{eq.descripcion}</p>
                            )}
                          </div>
                          <div className="flex gap-2 ml-2 flex-shrink-0">
                            <button onClick={e => { e.stopPropagation(); setEditingEquipo(eq); setEquipoForm({ nombre: eq.nombre, descripcion: eq.descripcion || "", color: eq.color || "295" }); setShowEquipoForm(false) }}
                              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5">
                              <Pencil size={11} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); handleDeleteEquipo(eq.id) }}
                              className="text-[11px] text-destructive/60 hover:text-destructive transition-colors flex items-center gap-0.5">
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>

                        {/* Avatares apilados */}
                        {miembros.length > 0 && (
                          <div className="flex items-center gap-1.5 mb-3">
                            <div className="flex -space-x-2">
                              {miembros.slice(0, 5).map(c => {
                                const ch = c.colorHue ?? hashHue(c.id)
                                return (
                                  <div key={c.id}
                                    className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[11px] ring-2 ring-card flex-shrink-0 overflow-hidden"
                                    style={{ background: c.avatarUrl ? "var(--muted)" : `linear-gradient(135deg, oklch(0.68 0.18 ${ch}), oklch(0.54 0.22 ${(ch+40)%360}))` }}
                                    title={c.nombre}>
                                    {c.avatarUrl
                                      ? <img src={c.avatarUrl} alt={c.nombre} className="w-full h-full object-cover" />
                                      : c.avatarEmoji
                                        ? <span className="text-sm leading-none">{c.avatarEmoji}</span>
                                        : c.nombre?.charAt(0).toUpperCase()
                                    }
                                  </div>
                                )
                              })}
                              {miembros.length > 5 && (
                                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground ring-2 ring-card">
                                  +{miembros.length - 5}
                                </div>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground ml-1">
                              {miembros.length} miembro{miembros.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                        )}

                        {/* Lista de nombres clicables */}
                        <div className="space-y-1.5">
                          {miembros.length === 0 ? (
                            <p className="text-[12px] text-muted-foreground italic">Sin miembros. Usa el lápiz para agregar.</p>
                          ) : (
                            miembros.map(c => {
                              const ch = c.colorHue ?? hashHue(c.id)
                              return (
                                <a key={c.id} href={`/colleague/${c.id}`} onClick={e => e.stopPropagation()}
                                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-muted/60 transition-colors group">
                                  <div className="w-6 h-6 rounded flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0 overflow-hidden"
                                    style={{ background: c.avatarUrl ? "var(--muted)" : `oklch(0.68 0.18 ${ch})` }}>
                                    {c.avatarUrl
                                      ? <img src={c.avatarUrl} alt={c.nombre} className="w-full h-full object-cover" />
                                      : c.avatarEmoji
                                        ? <span className="text-xs leading-none">{c.avatarEmoji}</span>
                                        : c.nombre?.charAt(0).toUpperCase()
                                    }
                                  </div>
                                  <span className="text-[12px] font-medium text-foreground truncate flex-1">
                                    {c.nombre?.split(" ").slice(0,2).join(" ")}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground truncate">{c.rol?.split(" ")[0]}</span>
                                  <span className="text-[11px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto">→</span>
                                </a>
                              )
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
            })()}
          </div>
        )}

      </main>

      <Footer />
      <Tutorial
        userEmail={user?.email}
        forceOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
      />
    </div>
  )
}
