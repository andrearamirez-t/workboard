import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { getColleagues } from "@/services/colleagues.service"
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
    background: `linear-gradient(135deg, oklch(0.65 0.16 ${h}), oklch(0.52 0.20 ${(h + 35) % 360}))`,
    boxShadow: `0 4px 12px oklch(0.58 0.18 ${h} / 35%)`,
  }
}

function cardAccentStyle() {
  return {
    background: "linear-gradient(135deg, oklch(0.52 0.14 285 / 0.55), oklch(0.44 0.16 312 / 0.60))",
  }
}

function areaBadgeStyle() {
  return {
    backgroundColor: "oklch(0.36 0.10 290)",
    color: "oklch(0.90 0.07 290)",
  }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [colleagues, setColleagues] = useState([])
  const [areaFilter, setAreaFilter] = useState("Todas")
  const [hoveredId, setHoveredId] = useState(null)

  useEffect(() => {
    if (!user) return
    getColleagues(user).then(setColleagues)
  }, [user])

  const areaCount = colleagues.reduce((acc, c) => {
    if (c.area) acc[c.area] = (acc[c.area] || 0) + 1
    return acc
  }, {})

  const areas = ["Todas", ...Array.from(new Set(colleagues.map(c => c.area).filter(Boolean))).sort()]
  const filtered = areaFilter === "Todas" ? colleagues : colleagues.filter(c => c.area === areaFilter)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border px-8 py-4 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-xl font-bold text-foreground">Workboard</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground hidden sm:block">{user?.displayName}</span>
          <Button variant="ghost" size="sm" onClick={() => navigate("/bitacora")}>Bitácora</Button>
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={logout}>Salir</Button>
        </div>
      </header>

      <main className="px-8 py-8 max-w-6xl mx-auto w-full flex-1">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Mi equipo</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{colleagues.length} persona{colleagues.length !== 1 ? "s" : ""} registrada{colleagues.length !== 1 ? "s" : ""}</p>
          </div>
          <Button size="sm" onClick={() => navigate("/colleague/new")}>+ Agregar compañero</Button>
        </div>

        {/* Filtro por enfoque */}
        {areas.length > 1 && (
          <div className="mb-8">
            <select
              value={areaFilter}
              onChange={e => setAreaFilter(e.target.value)}
              className="bg-card border border-border rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer">
              <option value="Todas">Todos los enfoques ({colleagues.length})</option>
              {areas.slice(1).map(a => (
                <option key={a} value={a}>{a} ({areaCount[a] || 0})</option>
              ))}
            </select>
          </div>
        )}

        {colleagues.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <UserCircle className="mx-auto mb-3" size={48} />
            <p>Aún no hay compañeros. Agrega el primero.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p>No hay compañeros en esta área.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((c) => {
              const isHovered = hoveredId === c.id
              return (
              <a key={c.id} href={`/colleague/${c.id}`}
                className="rounded-2xl overflow-hidden border transition-all duration-300 cursor-pointer block group bg-card"
                onMouseEnter={() => setHoveredId(c.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  borderColor: isHovered ? "oklch(0.62 0.18 290)" : "oklch(0.30 0.04 290)",
                  transform: isHovered ? "translateY(-5px) scale(1.01)" : "translateY(0) scale(1)",
                  boxShadow: isHovered
                    ? "0 12px 40px oklch(0.52 0.20 290 / 30%), 0 0 0 1px oklch(0.62 0.18 290 / 35%)"
                    : "0 4px 20px oklch(0.15 0.02 290 / 30%)",
                }}>

                {/* Cabecera */}
                <div className="px-5 pt-5 pb-4 relative overflow-hidden" style={cardAccentStyle()}>
                  {isHovered && (
                    <div className="card-shine absolute inset-0 pointer-events-none"
                      style={{ background: "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.45) 50%, transparent 65%)" }} />
                  )}
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center text-white font-bold text-lg"
                      style={avatarStyle(c.id)}>
                      {c.nombre?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="font-bold leading-tight text-base text-card-foreground">{c.nombre}</p>
                      <p className="text-xs mt-0.5 text-muted-foreground">{c.rol || "Sin rol"}</p>
                      {c.area && (
                        <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mt-1.5"
                          style={areaBadgeStyle()}>
                          {c.area}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Cuerpo */}
                <div className="bg-card px-5 py-4 space-y-3">
                  {c.trabajaEn && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Trabajando en</p>
                      <p className="text-sm text-foreground line-clamp-2 leading-relaxed">{c.trabajaEn}</p>
                    </div>
                  )}
                  {c.herramientas?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {c.herramientas.slice(0, 4).map((tool) => (
                        <span key={tool} className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
                          {tool}
                        </span>
                      ))}
                      {c.herramientas.length > 4 && (
                        <span className="text-xs px-2 py-0.5 rounded-full text-muted-foreground bg-muted">
                          +{c.herramientas.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      {c.proyectos?.length || 0} proyecto{c.proyectos?.length !== 1 ? "s" : ""}
                    </p>
                    <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">Ver perfil →</span>
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
