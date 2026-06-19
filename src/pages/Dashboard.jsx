import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { getColleagues } from "@/services/colleagues.service"
import { getAllLogs } from "@/services/logs.service"
import { exportPDF, exportExcel } from "@/utils/exportReport"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { Footer } from "@/components/ui/Footer"
import { UserCircle } from "lucide-react"

function hashHue(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return Math.abs(h * 137.508) % 360
}

function avatarStyle(id) {
  const h = hashHue(id)
  return {
    background: `linear-gradient(135deg, oklch(0.68 0.18 ${h}), oklch(0.54 0.22 ${(h + 40) % 360}))`,
  }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [colleagues, setColleagues] = useState([])
  const [areaFilter, setAreaFilter] = useState("Todas")
  const [hoveredId, setHoveredId] = useState(null)
  const [exporting, setExporting] = useState(null)

  useEffect(() => {
    if (!user) return
    getColleagues(user).then(setColleagues)
  }, [user])

  const handleExport = async (type) => {
    setExporting(type)
    const logs = await getAllLogs(user.uid)
    if (type === "pdf") exportPDF(colleagues, logs)
    else exportExcel(colleagues, logs)
    setExporting(null)
  }

  const areaCount = colleagues.reduce((acc, c) => {
    if (c.area) acc[c.area] = (acc[c.area] || 0) + 1
    return acc
  }, {})

  const areas = ["Todas", ...Array.from(new Set(colleagues.map(c => c.area).filter(Boolean))).sort()]
  const filtered = areaFilter === "Todas" ? colleagues : colleagues.filter(c => c.area === areaFilter)

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
        <div className="flex items-center gap-1">
          {user?.displayName && (
            <span className="hidden md:block text-xs text-muted-foreground px-2 py-1">{user.displayName}</span>
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate("/bitacora")} className="text-[13px] h-8">
            Bitácora
          </Button>
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={logout} className="text-[13px] h-8">
            Salir
          </Button>
        </div>
      </header>

      <main className="px-6 py-8 max-w-6xl mx-auto w-full flex-1">

        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-8">
          <div>
            <h2 className="text-[28px] font-bold tracking-tight text-foreground leading-none">Mi equipo</h2>
            <p className="text-[13px] text-muted-foreground mt-1.5">
              {colleagues.length} persona{colleagues.length !== 1 ? "s" : ""} registrada{colleagues.length !== 1 ? "s" : ""}
            </p>
          </div>
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
        </div>

        {/* ── Filter ── */}
        {areas.length > 1 && (
          <div className="mb-6">
            <select value={areaFilter} onChange={e => setAreaFilter(e.target.value)}
              className="h-9 bg-card border border-border rounded-xl px-3.5 text-[13px] text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-ring/40 cursor-pointer">
              <option value="Todas">Todos los enfoques · {colleagues.length}</option>
              {areas.slice(1).map(a => (
                <option key={a} value={a}>{a} · {areaCount[a] || 0}</option>
              ))}
            </select>
          </div>
        )}

        {/* ── States ── */}
        {colleagues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-muted-foreground animate-fade-up">
            <div className="w-14 h-14 rounded-2xl mb-4 flex items-center justify-center"
              style={{ background: "oklch(0.52 0.24 295 / 0.10)" }}>
              <UserCircle size={26} style={{ color: "oklch(0.52 0.24 295)" }} />
            </div>
            <p className="font-semibold text-foreground text-[15px]">Sin compañeros aún</p>
            <p className="text-[13px] mt-1">Agrega el primero para empezar.</p>
            <Button size="sm" className="mt-5" onClick={() => navigate("/colleague/new")}>
              + Agregar compañero
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-[13px]">No hay compañeros en este enfoque.</p>
          </div>
        ) : (

          /* ── Cards grid ── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c) => {
              const h = hashHue(c.id)
              const isHovered = hoveredId === c.id
              return (
                <a key={c.id} href={`/colleague/${c.id}`}
                  className="group block rounded-2xl bg-card border border-border overflow-hidden cursor-pointer"
                  onMouseEnter={() => setHoveredId(c.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    borderLeftColor: `oklch(0.60 0.18 ${h})`,
                    borderLeftWidth: "3px",
                    transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
                    transform: isHovered ? "translateY(-2px)" : "translateY(0)",
                    boxShadow: isHovered
                      ? `0 12px 36px oklch(0.55 0.18 ${h} / 18%), 0 0 0 1px oklch(0.60 0.18 ${h} / 15%)`
                      : "0 1px 3px oklch(0 0 0 / 5%), 0 2px 8px oklch(0 0 0 / 4%)",
                  }}>

                  <div className="p-5 space-y-3.5">

                    {/* Avatar + Name + Role + Area */}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-bold text-[15px]"
                        style={avatarStyle(c.id)}>
                        {c.nombre?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[15px] text-foreground leading-tight truncate">{c.nombre}</p>
                        <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{c.rol || "Sin rol"}</p>
                        {c.area && (
                          <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1.5 leading-4"
                            style={{ backgroundColor: `oklch(0.60 0.18 ${h} / 0.12)`, color: `oklch(0.48 0.20 ${h})` }}>
                            {c.area}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Working on */}
                    {c.trabajaEn && (
                      <p className="text-[13px] text-muted-foreground line-clamp-2 leading-relaxed">{c.trabajaEn}</p>
                    )}

                    {/* Tools */}
                    {c.herramientas?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {c.herramientas.slice(0, 4).map(tool => (
                          <span key={tool} className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
                            {tool}
                          </span>
                        ))}
                        {c.herramientas.length > 4 && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                            +{c.herramientas.length - 4}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Card footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-[12px] text-muted-foreground">
                        {c.proyectos?.length || 0} proyecto{c.proyectos?.length !== 1 ? "s" : ""}
                      </span>
                      <span className="text-[12px] font-medium text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-0.5">
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
    </div>
  )
}
