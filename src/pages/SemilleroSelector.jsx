import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import {
  getSemilleros, createSemillero, updateSemillero, deleteSemillero
} from "@/services/semilleros.service"
import { migrateColleaguesToSemillero } from "@/services/colleagues.service"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { Plus, Users, Pencil, Trash2, LogOut, ArrowRight, Layers, X, Check, BarChart2 } from "lucide-react"

const SUPER_ADMIN_EMAILS = ["andrea_ramirezt@cun.edu.co", "angela_bernalm@cun.edu.co", "jose_forero@cun.edu.co"]
const HUES = ["165", "295", "230", "40", "10", "180", "316", "260"]

export default function SemilleroSelector() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isManageMode = searchParams.get("manage") === "true"
  const { user, logout, mySemilleroId, isCoordinador, loading: authLoading } = useAuth()
  const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(user?.email)

  const [semilleros, setSemilleros] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ nombre: "", descripcion: "", color: "165" })
  const [saving, setSaving] = useState(false)
  const [migrating, setMigrating] = useState(null)
  const [migrateSuccess, setMigrateSuccess] = useState(null)

  // Non-super-admin: redirect to own semillero
  useEffect(() => {
    if (authLoading) return
    if (isSuperAdmin && !isManageMode) {
      navigate("/overview", { replace: true })
      return
    }
    if (!isSuperAdmin && mySemilleroId) {
      navigate(`/semillero/${mySemilleroId}/dashboard`, { replace: true })
    }
  }, [isSuperAdmin, isManageMode, mySemilleroId, authLoading, navigate])

  useEffect(() => {
    if (!isSuperAdmin) return
    getSemilleros()
      .then(data => { setSemilleros(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [isSuperAdmin])

  const openCreate = () => {
    setEditingId(null)
    setForm({ nombre: "", descripcion: "", color: "165" })
    setShowForm(true)
  }

  const openEdit = (sem) => {
    setEditingId(sem.id)
    setForm({ nombre: sem.nombre, descripcion: sem.descripcion || "", color: sem.color || "165" })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.nombre.trim()) return
    setSaving(true)
    try {
      if (editingId) {
        await updateSemillero(editingId, {
          nombre: form.nombre.trim(),
          descripcion: form.descripcion.trim(),
          color: form.color,
        })
      } else {
        await createSemillero(
          { nombre: form.nombre.trim(), descripcion: form.descripcion.trim(), color: form.color },
          user?.uid
        )
      }
      const updated = await getSemilleros()
      setSemilleros(updated)
      setShowForm(false)
    } catch (e) {
      console.error("Error guardando semillero:", e)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar este semillero? Esta acción no borra los compañeros.")) return
    await deleteSemillero(id).catch(() => {})
    setSemilleros(prev => prev.filter(s => s.id !== id))
  }

  const handleMigrate = async (semilleroId) => {
    setMigrating(semilleroId)
    setMigrateSuccess(null)
    try {
      const count = await migrateColleaguesToSemillero(semilleroId)
      setMigrateSuccess({ id: semilleroId, count })
    } catch (e) {
      console.error("Error migrando:", e)
    } finally {
      setMigrating(null)
    }
  }

  const userInitial = user?.displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "?"
  const userName = user?.displayName || user?.email?.split("@")[0] || "Usuario"

  // Non-super-admin loading state
  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
            style={{ background: "oklch(0.52 0.13 165 / 0.12)" }}>
            <Layers size={24} style={{ color: "oklch(0.52 0.13 165)" }} />
          </div>
          {mySemilleroId
            ? <p className="text-muted-foreground text-[14px]">Redirigiendo…</p>
            : (
              <div className="space-y-1.5">
                <p className="font-semibold text-foreground text-[16px]">Sin equipo asignado</p>
                <p className="text-muted-foreground text-[13px]">Pídele a un administrador que te asigne a un equipo.</p>
                <button onClick={logout} className="mt-4 text-[13px] text-muted-foreground hover:text-foreground flex items-center gap-1.5 mx-auto transition-colors">
                  <LogOut size={14} /> Cerrar sesión
                </button>
              </div>
            )
          }
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Hero header */}
      <div className="relative overflow-hidden px-6 py-10 flex-shrink-0"
        style={{ background: "linear-gradient(125deg, oklch(0.46 0.13 165) 0%, oklch(0.40 0.14 185) 45%, oklch(0.48 0.14 245) 100%)" }}>
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-10 pointer-events-none"
          style={{ background: "radial-gradient(circle, oklch(1 0 0), transparent 70%)" }} />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full opacity-8 pointer-events-none"
          style={{ background: "radial-gradient(circle, oklch(0.58 0.16 295), transparent 70%)" }} />

        <div className="relative z-10 max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            {isManageMode && (
              <button onClick={() => navigate("/overview")}
                className="flex items-center gap-1.5 text-[12px] mb-3 hover:opacity-80 transition-opacity"
                style={{ color: "oklch(1 0 0 / 0.65)" }}>
                ← Dashboard global
              </button>
            )}
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-1"
              style={{ color: "oklch(1 0 0 / 0.55)" }}>
              Workboard · CUN Investigación
            </p>
            <h1 className="text-[28px] font-black text-white leading-tight">Gestionar equipos</h1>
            <p className="text-[13px] mt-1" style={{ color: "oklch(1 0 0 / 0.65)" }}>
              Crea, edita o elimina los equipos de investigación
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* User chip */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: "oklch(1 0 0 / 0.12)" }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                style={{ background: "oklch(1 0 0 / 0.25)" }}>
                {userInitial}
              </div>
              <span className="text-white text-[13px] font-medium hidden sm:block">{userName.split(" ")[0]}</span>
            </div>
            <ThemeToggle />
            <button onClick={logout} title="Cerrar sesión"
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: "oklch(1 0 0 / 0.12)", color: "oklch(1 0 0 / 0.8)" }}
              onMouseEnter={e => e.currentTarget.style.background = "oklch(1 0 0 / 0.22)"}
              onMouseLeave={e => e.currentTarget.style.background = "oklch(1 0 0 / 0.12)"}>
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">

        {/* Action bar */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-[13px] text-muted-foreground">
            {loading ? "Cargando…" : `${semilleros.length} equipo${semilleros.length !== 1 ? "s" : ""}`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/overview")}
              className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold border border-border hover:bg-muted transition-colors text-foreground">
              <BarChart2 size={15} /> Vista general
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold text-white transition-all"
              style={{
                background: "linear-gradient(135deg, oklch(0.52 0.13 165), oklch(0.44 0.14 185))",
                boxShadow: "0 4px 14px oklch(0.52 0.13 165 / 30%)",
              }}
              onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.08)"}
              onMouseLeave={e => e.currentTarget.style.filter = ""}>
              <Plus size={15} /> Nuevo equipo
            </button>
          </div>
        </div>

        {/* Create / Edit form */}
        {showForm && (
          <div className="bg-card border border-border rounded-2xl p-5 mb-6 space-y-4"
            style={{ borderLeft: `3px solid oklch(0.62 0.18 ${form.color})` }}>
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-semibold text-foreground">
                {editingId ? "Editar equipo" : "Nuevo equipo"}
              </p>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                placeholder="Nombre del equipo *"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                className="bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
              <input
                placeholder="Descripción (opcional)"
                value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                className="bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
            <div className="flex items-center gap-2">
              <p className="text-[12px] text-muted-foreground">Color:</p>
              {HUES.map(hue => (
                <button key={hue} onClick={() => setForm(f => ({ ...f, color: hue }))}
                  className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                  style={{
                    background: `oklch(0.62 0.22 ${hue})`,
                    outline: form.color === hue ? `2px solid oklch(0.62 0.22 ${hue})` : "none",
                    outlineOffset: 2,
                  }} />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || !form.nombre.trim()}
                className="h-9 px-4 rounded-xl text-[13px] font-semibold text-white disabled:opacity-50 transition-all"
                style={{ background: "linear-gradient(135deg, oklch(0.52 0.13 165), oklch(0.44 0.14 185))" }}>
                {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear equipo"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="h-9 px-4 rounded-xl text-[13px] font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Cards grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="rounded-2xl border border-border bg-card p-6 animate-pulse space-y-3">
                <div className="w-12 h-12 rounded-xl bg-muted" />
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : semilleros.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl mb-4 flex items-center justify-center"
              style={{ background: "oklch(0.52 0.13 165 / 0.10)" }}>
              <Layers size={28} style={{ color: "oklch(0.52 0.13 165)" }} />
            </div>
            <p className="font-semibold text-foreground text-[16px]">Sin equipos</p>
            <p className="text-[13px] text-muted-foreground mt-1">Crea el primero con el botón de arriba.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {semilleros.map(sem => {
              const hue = sem.color || "165"
              const successMsg = migrateSuccess?.id === sem.id ? migrateSuccess : null
              return (
                <div key={sem.id}
                  className="relative rounded-2xl overflow-hidden bg-card border border-border flex flex-col cursor-pointer group"
                  style={{ transition: "transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease" }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = "translateY(-3px)"
                    e.currentTarget.style.boxShadow = `0 16px 48px oklch(0.55 0.18 ${hue} / 14%), 0 4px 16px oklch(0 0 0 / 8%)`
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = ""
                    e.currentTarget.style.boxShadow = ""
                  }}>

                  {/* Color top stripe */}
                  <div className="h-[3px] w-full flex-shrink-0"
                    style={{ background: `linear-gradient(90deg, oklch(0.62 0.18 ${hue}), oklch(0.55 0.18 ${(+hue + 40) % 360} / 0.4))` }} />

                  <div className="flex-1 p-5 space-y-3">
                    {/* Icon + actions */}
                    <div className="flex items-start justify-between">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-[18px] font-black flex-shrink-0"
                        style={{
                          background: `linear-gradient(135deg, oklch(0.62 0.18 ${hue}), oklch(0.50 0.20 ${(+hue + 20) % 360}))`,
                          boxShadow: `0 6px 18px oklch(0.60 0.18 ${hue} / 30%)`,
                        }}>
                        {sem.nombre?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => openEdit(sem)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(sem.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
                          style={{ color: "oklch(0.60 0.22 27)" }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Name & description */}
                    <div>
                      <h3 className="font-bold text-[16px] text-foreground leading-tight">{sem.nombre}</h3>
                      {sem.descripcion && (
                        <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-2">{sem.descripcion}</p>
                      )}
                    </div>

                    {/* Migrate button */}
                    <div onClick={e => e.stopPropagation()}>
                      {successMsg ? (
                        <div className="flex items-center gap-1.5 text-[12px] font-medium"
                          style={{ color: "oklch(0.52 0.13 165)" }}>
                          <Check size={13} />
                          {successMsg.count} compañero{successMsg.count !== 1 ? "s" : ""} migrado{successMsg.count !== 1 ? "s" : ""}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleMigrate(sem.id)}
                          disabled={migrating === sem.id}
                          className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                          title="Asigna los compañeros sin semillero a este equipo">
                          {migrating === sem.id ? "Migrando…" : "Migrar compañeros existentes →"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Enter button */}
                  <div className="px-5 pb-4">
                    <button
                      onClick={() => navigate(`/semillero/${sem.id}/dashboard`)}
                      className="w-full flex items-center justify-center gap-2 h-9 rounded-xl text-[13px] font-semibold text-white transition-all"
                      style={{
                        background: `linear-gradient(135deg, oklch(0.62 0.18 ${hue}), oklch(0.50 0.20 ${(+hue + 20) % 360}))`,
                        boxShadow: `0 4px 14px oklch(0.60 0.18 ${hue} / 25%)`,
                      }}
                      onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.08)"}
                      onMouseLeave={e => e.currentTarget.style.filter = ""}>
                      Abrir workspace <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
