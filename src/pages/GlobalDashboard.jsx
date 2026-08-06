import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { getSemilleros } from "@/services/semilleros.service"
import { getColleagues } from "@/services/colleagues.service"
import { getAllLogs } from "@/services/logs.service"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { MetricsDashboard } from "@/components/ui/MetricsDashboard"
import { NotificationBell } from "@/components/ui/NotificationBell"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  Users, Briefcase, Layers, ArrowRight, LogOut,
  Home, TrendingUp, BarChart2, Menu, Settings,
  ChevronRight, ChevronDown, Activity
} from "lucide-react"

const SUPER_ADMIN_EMAILS = ["andrea_ramirezt@cun.edu.co", "angela_bernalm@cun.edu.co", "jose_forero@cun.edu.co"]

function StatCard({ label, value, sub, hue = "165" }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <p className="text-[28px] font-black text-foreground leading-none">{value}</p>
      <p className="text-[13px] text-muted-foreground mt-1">{label}</p>
      {sub && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function GlobalDashboard() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(user?.email)

  const [semilleros, setSemilleros] = useState([])
  const [colleagues, setColleagues] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("resumen")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedLogId, setExpandedLogId] = useState(null)

  useEffect(() => {
    if (!isSuperAdmin) { navigate("/semilleros", { replace: true }); return }
    Promise.all([getSemilleros(), getColleagues(), getAllLogs()])
      .then(([sems, cols, ls]) => {
        setSemilleros(sems)
        setColleagues(cols)
        setLogs(ls)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [isSuperAdmin, navigate])

  // Stats globales
  const semStats = semilleros.map(s => {
    const members = colleagues.filter(c => c.semilleroId === s.id)
    const proyectos = members.reduce((acc, c) => acc + (c.proyectos?.length || 0), 0)
    const herramientas = members.reduce((acc, c) => acc + (c.herramientas?.length || 0), 0)
    const withProjects = members.filter(c => c.proyectos?.length > 0).length
    return { ...s, memberCount: members.length, proyectos, herramientas, withProjects }
  })

  const totalPersonas = colleagues.length
  const totalProyectos = colleagues.reduce((acc, c) => acc + (c.proyectos?.length || 0), 0)
  const totalHerramientas = new Set(colleagues.flatMap(c => c.herramientas || [])).size
  const sinEquipo = colleagues.filter(c => !c.semilleroId).length

  const userInitial = user?.displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "?"
  const userFirstName = (user?.displayName || user?.email?.split("@")[0] || "Usuario").split(" ")[0]

  const navItems = [
    { key: "resumen",  label: "Resumen",  icon: Home },
    { key: "analisis", label: "Análisis", icon: TrendingUp },
  ]

  // ── SIDEBAR ──────────────────────────────────────────────────────────────
  const Sidebar = (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-50 flex flex-col border-r border-border/50
        transition-transform duration-300 ease-in-out
        lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      style={{ width: 228, background: "var(--sidebar)" }}>

      {/* Logo */}
      <div className="px-5 pt-6 pb-5 flex items-center gap-3 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[15px] font-black flex-shrink-0"
          style={{
            background: "linear-gradient(140deg, oklch(0.52 0.13 165), oklch(0.42 0.14 185))",
            boxShadow: "0 4px 14px oklch(0.52 0.13 165 / 40%)",
          }}>
          W
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-foreground leading-none">Workboard</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-none truncate">Vista global</p>
        </div>
      </div>

      <div className="mx-4 h-px bg-border/70 flex-shrink-0" />

      {/* User card */}
      <div className="px-4 py-4 flex-shrink-0">
        <div className="flex items-center gap-2.5 px-3 py-3 rounded-xl"
          style={{ background: "oklch(0.52 0.13 165 / 0.08)" }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0"
            style={{ background: "linear-gradient(135deg, oklch(0.52 0.13 165), oklch(0.42 0.14 185))" }}>
            {userInitial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-foreground truncate leading-snug">{userFirstName}</p>
            <p className="text-[10px] truncate leading-snug" style={{ color: "oklch(0.52 0.13 165)" }}>
              Super Admin
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto">

        {/* Sección principal */}
        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest px-3 mb-2">
          General
        </p>
        {navItems.map(t => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button key={t.key}
              onClick={() => { setTab(t.key); setSidebarOpen(false) }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all text-left"
              style={active ? {
                background: "var(--primary)",
                color: "oklch(1 0 0)",
                boxShadow: "0 4px 18px oklch(0.52 0.13 165 / 30%)",
              } : { color: "var(--muted-foreground)" }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--muted)" }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = "" }}>
              <Icon size={16} className="flex-shrink-0" />
              {t.label}
            </button>
          )
        })}

        {/* Separador equipos */}
        <div className="pt-3 pb-1">
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest px-3">
            Equipos
          </p>
        </div>

        {semilleros.map(s => {
          const h = s.color || "165"
          return (
            <button key={s.id}
              onClick={() => { navigate(`/semillero/${s.id}/dashboard`); setSidebarOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all text-left group"
              style={{ color: "var(--muted-foreground)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--muted)"; e.currentTarget.style.color = "var(--foreground)" }}
              onMouseLeave={e => { e.currentTarget.style.background = ""; e.currentTarget.style.color = "var(--muted-foreground)" }}>
              <div className="w-5 h-5 rounded-md flex-shrink-0"
                style={{ background: `oklch(0.62 0.18 ${h} / 0.20)`, border: `1.5px solid oklch(0.62 0.18 ${h} / 0.40)` }} />
              <span className="truncate flex-1">{s.nombre}</span>
              <ChevronRight size={12} className="flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
            </button>
          )
        })}

        {/* Gestionar equipos */}
        <div className="pt-2">
          <button
            onClick={() => { navigate("/semilleros?manage=true"); setSidebarOpen(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all text-left"
            style={{ color: "var(--muted-foreground)" }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--muted)"}
            onMouseLeave={e => e.currentTarget.style.background = ""}>
            <Settings size={13} className="flex-shrink-0" />
            Gestionar equipos
          </button>
        </div>
      </nav>

      <div className="mx-4 h-px bg-border/70 flex-shrink-0" />

      {/* Bottom */}
      <div className="px-3 py-4 space-y-0.5 flex-shrink-0">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors hover:bg-muted text-left"
          style={{ color: "var(--destructive)" }}>
          <LogOut size={16} className="flex-shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )

  return (
    <div className="min-h-screen bg-background flex">

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden"
          style={{ background: "oklch(0 0 0 / 45%)", backdropFilter: "blur(2px)" }}
          onClick={() => setSidebarOpen(false)} />
      )}

      {Sidebar}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-h-screen">
        <style>{`@media (min-width: 1024px) { .main-offset { margin-left: 228px; } }`}</style>
        <div className="main-offset flex flex-col min-h-screen flex-1">

          {/* Top bar */}
          <header className="sticky top-0 z-20 h-14 border-b border-border/60 px-5 flex items-center gap-3"
            style={{ backgroundColor: "color-mix(in srgb, var(--background) 85%, transparent)", backdropFilter: "blur(20px)" }}>
            <button
              className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors flex-shrink-0"
              onClick={() => setSidebarOpen(v => !v)}>
              <Menu size={16} className="text-muted-foreground" />
            </button>
            <div className="hidden lg:flex items-center gap-2">
              <span className="text-[12px] text-muted-foreground">Workboard</span>
              <span className="text-[12px] text-muted-foreground">/</span>
              <span className="text-[13px] font-semibold text-foreground">
                {tab === "resumen" ? "Resumen global" : "Análisis global"}
              </span>
            </div>
            <span className="lg:hidden text-[14px] font-semibold text-foreground">
              {tab === "resumen" ? "Resumen global" : "Análisis global"}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <NotificationBell isAdmin={true} userEmail={user?.email} userUid={user?.uid} />
              <ThemeToggle />
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 p-6 space-y-6 overflow-y-auto">

            {loading ? (
              <div className="flex items-center justify-center py-32">
                <div className="text-center space-y-3">
                  <BarChart2 size={28} className="mx-auto text-muted-foreground opacity-30" />
                  <p className="text-[13px] text-muted-foreground">Cargando datos…</p>
                </div>
              </div>
            ) : tab === "resumen" ? (
              <>
                {/* Stat cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard label="Equipos activos" value={semilleros.length} hue="165" />
                  <StatCard label="Total de personas" value={totalPersonas}
                    sub={`${sinEquipo} sin equipo asignado`} hue="230" />
                  <StatCard label="Proyectos en total" value={totalProyectos}
                    sub={`~${semilleros.length ? (totalProyectos / semilleros.length).toFixed(1) : 0} por equipo`} hue="295" />
                  <StatCard label="Herramientas distintas" value={totalHerramientas} hue="40" />
                </div>

                {/* Equipos breakdown */}
                <section>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
                    Desglose por equipo
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {semStats.map(s => {
                      const h = s.color || "165"
                      const pct = s.memberCount > 0
                        ? Math.round((s.withProjects / s.memberCount) * 100) : 0
                      return (
                        <div key={s.id}
                          className="bg-card border border-border rounded-2xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => navigate(`/semillero/${s.id}/dashboard`)}>
                          <div className="h-[3px] w-full"
                            style={{ background: `linear-gradient(90deg, oklch(0.62 0.18 ${h}), oklch(0.55 0.18 ${(Number(h) + 40) % 360} / 0.4))` }} />
                          <div className="p-5">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                                  style={{ background: `oklch(0.62 0.18 ${h} / 0.15)` }}>
                                  <Layers size={15} style={{ color: `oklch(0.58 0.18 ${h})` }} />
                                </div>
                                <div>
                                  <p className="text-[14px] font-semibold text-foreground">{s.nombre}</p>
                                  {s.descripcion && (
                                    <p className="text-[11px] text-muted-foreground line-clamp-1">{s.descripcion}</p>
                                  )}
                                </div>
                              </div>
                              <ArrowRight size={14} className="text-muted-foreground" />
                            </div>
                            <div className="grid grid-cols-3 gap-2 mb-3">
                              {[
                                { label: "Personas", value: s.memberCount },
                                { label: "Proyectos", value: s.proyectos },
                                { label: "Herramientas", value: s.herramientas },
                              ].map(st => (
                                <div key={st.label} className="text-center py-2 rounded-xl"
                                  style={{ background: `oklch(0.62 0.18 ${h} / 0.07)` }}>
                                  <p className="text-[18px] font-bold text-foreground leading-none">{st.value}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{st.label}</p>
                                </div>
                              ))}
                            </div>
                            <div>
                              <div className="flex justify-between mb-1">
                                <p className="text-[11px] text-muted-foreground">Con proyectos activos</p>
                                <p className="text-[11px] font-semibold text-foreground">{pct}%</p>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full"
                                  style={{
                                    width: `${pct}%`,
                                    background: `linear-gradient(90deg, oklch(0.62 0.18 ${h}), oklch(0.55 0.18 ${(Number(h) + 40) % 360}))`,
                                  }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>

                {/* Actividad reciente */}
                {logs.length > 0 && (
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                        Actividad reciente · todos los equipos
                      </p>
                      <span className="text-[11px] text-muted-foreground">{logs.length} notas</span>
                    </div>
                    <div className="bg-card border border-border rounded-2xl overflow-hidden">
                      <div className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: 440 }}>
                        {logs.map((log, i) => {
                          const sem = semilleros.find(s => s.id === log.semilleroId)
                          const h = sem?.color || "165"
                          const isExpanded = expandedLogId === log.id
                          const logDate = log.createdAt?.toDate?.() || (log.createdAt?.seconds ? new Date(log.createdAt.seconds * 1000) : null)
                          const hasLongNote = (log.nota || "").length > 90
                          return (
                            <div key={log.id}
                              className={`px-4 py-3 hover:bg-muted/30 transition-colors ${i < logs.length - 1 ? "border-b border-border/50" : ""}`}>
                              {/* Cabecera: avatar + nombre + equipo + fecha + chevron */}
                              <div
                                className="flex items-center gap-3 cursor-pointer"
                                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}>
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                                  style={{ background: `linear-gradient(135deg, oklch(0.62 0.18 ${h}), oklch(0.52 0.18 ${(Number(h) + 40) % 360}))` }}>
                                  {log.colleagueName?.charAt(0)?.toUpperCase() || "?"}
                                </div>
                                <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
                                  <span className="text-[13px] font-semibold text-foreground truncate shrink-0" style={{ maxWidth: 150 }}>
                                    {log.colleagueName || "—"}
                                  </span>
                                  {sem && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium whitespace-nowrap flex-shrink-0"
                                      style={{ background: `oklch(0.62 0.18 ${h} / 0.12)`, color: `oklch(0.50 0.18 ${h})` }}>
                                      {sem.nombre}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {logDate && (
                                    <span className="text-[11px] text-muted-foreground whitespace-nowrap hidden sm:block">
                                      {format(logDate, "d MMM", { locale: es })}
                                    </span>
                                  )}
                                  <ChevronDown size={13} className="text-muted-foreground"
                                    style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                                </div>
                              </div>
                              {/* Nota: siempre debajo, wrapping vertical */}
                              <div className="mt-1.5 pl-10">
                                <p className="text-[12px] text-muted-foreground break-words leading-relaxed"
                                  style={{ display: "-webkit-box", WebkitLineClamp: isExpanded ? "unset" : 2, WebkitBoxOrient: "vertical", overflow: isExpanded ? "visible" : "hidden" }}>
                                  {log.nota}
                                </p>
                                {hasLongNote && (
                                  <button
                                    className="text-[11px] font-medium mt-1 transition-colors hover:opacity-70"
                                    style={{ color: `oklch(0.52 0.13 165)` }}
                                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}>
                                    {isExpanded ? "Ver menos" : "Ver más"}
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </section>
                )}
              </>
            ) : (
              /* Tab: Análisis — reutiliza MetricsDashboard con todos los datos */
              <MetricsDashboard colleagues={colleagues} logs={logs} />
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
