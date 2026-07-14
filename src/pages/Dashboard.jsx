import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { getColleagues } from "@/services/colleagues.service"
import { getAllLogs } from "@/services/logs.service"
import { exportPDF, exportExcel } from "@/utils/exportReport"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { Footer } from "@/components/ui/Footer"
import { UserCircle, Search } from "lucide-react"
import { NotificationBell } from "@/components/ui/NotificationBell"
import { Tutorial, resetTutorial } from "@/components/ui/Tutorial"

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
  const [exporting, setExporting] = useState(null)
  const [showTutorial, setShowTutorial] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoadingData(true)
    getColleagues().then(data => {
      setColleagues(data)
      setLoadingData(false)
    })
  }, [user])

  const handleExport = async (type) => {
    setExporting(type)
    const logs = await getAllLogs()
    if (type === "pdf") exportPDF(colleagues, logs)
    else exportExcel(colleagues, logs)
    setExporting(null)
  }

  const totalProjects = colleagues.reduce((sum, c) => sum + (c.proyectos?.length || 0), 0)
  const totalTools = new Set(colleagues.flatMap(c => c.herramientas || [])).size

  const filtered = colleagues.filter(c => {
    const q = search.toLowerCase()
    return !q ||
      c.nombre?.toLowerCase().includes(q) ||
      c.rol?.toLowerCase().includes(q) ||
      c.herramientas?.some(t => t.toLowerCase().includes(q)) ||
      c.area?.toLowerCase().includes(q)
  })

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
            <NotificationBell isAdmin={isAdmin} myColleagueId={myColleagueId} userEmail={user?.email} />
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
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-7">
          <div>
            <h2 className="text-[30px] font-bold tracking-tight text-foreground leading-none">Mi equipo</h2>
            <p className="text-[13px] text-muted-foreground mt-1.5">
              Investigación e innovación · {colleagues.length} persona{colleagues.length !== 1 ? "s" : ""}
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => handleExport("pdf")} disabled={!!exporting}
                className="h-8 text-[12px] font-medium px-3 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all disabled:opacity-40">
                {exporting === "pdf" ? "Generando…" : "↓ PDF"}
              </button>
              <button onClick={() => handleExport("xlsx")} disabled={!!exporting}
                className="h-8 text-[12px] font-medium px-3 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all disabled:opacity-40">
                {exporting === "xlsx" ? "Generando…" : "↓ Excel"}
              </button>
              <Button size="sm" className="h-8 text-[13px]" onClick={() => navigate("/colleague/new")}>
                + Compañero
              </Button>
            </div>
          )}
        </div>

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
              const h = hashHue(c.id)
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
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-[16px]"
                          style={{ background: `linear-gradient(135deg, oklch(0.68 0.18 ${h}), oklch(0.54 0.22 ${(h + 40) % 360}))` }}>
                          {c.nombre?.charAt(0).toUpperCase()}
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
                        {c.area && (
                          <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1.5 leading-4"
                            style={{ backgroundColor: `oklch(0.60 0.18 ${h} / 0.13)`, color: `oklch(0.50 0.20 ${h})` }}>
                            {c.area}
                          </span>
                        )}
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
