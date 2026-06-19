import { useState } from "react"
import { useParams, useNavigate, useLocation } from "react-router-dom"
import { doc, updateDoc, arrayUnion } from "firebase/firestore"
import { db } from "@/services/firebase"
import { updateProject } from "@/services/colleagues.service"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { Footer } from "@/components/ui/Footer"

const AREAS = [
  "Desarrollo de Software", "Robótica", "Inteligencia Artificial",
  "Infraestructura / DevOps", "Diseño UX/UI", "Investigación", "Soporte Técnico",
]
const PROJECT_STATES = ["Planificación", "En desarrollo", "En revisión", "Completado", "Pausado"]
const VERSION_STATES = ["Pendiente", "En curso", "Entregado", "Cancelado"]

export default function ProjectForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const editData = location.state?.editProject
  const isEdit = Boolean(editData)

  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nombre: editData?.nombre || "",
    estado: editData?.estado || "",
    area: editData?.area || "",
    queHace: editData?.queHace || "",
    herramientas: (editData?.herramientas || []).join(", "),
    observaciones: editData?.observaciones || "",
    fechaInicio: editData?.fechaInicio || "",
    fechaEntrega: editData?.fechaEntrega || "",
    versiones: editData?.versiones || [],
  })

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const addVersion = () => setForm(f => ({ ...f, versiones: [...f.versiones, { nombre: "", fecha: "", estado: "" }] }))
  const removeVersion = (i) => setForm(f => ({ ...f, versiones: f.versiones.filter((_, idx) => idx !== i) }))
  const updateVersion = (i, key, value) => {
    const updated = [...form.versiones]
    updated[i] = { ...updated[i], [key]: value }
    setForm(f => ({ ...f, versiones: updated }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim()) return
    setSaving(true)
    const proyecto = {
      nombre: form.nombre.trim(),
      estado: form.estado,
      area: form.area.trim(),
      queHace: form.queHace.trim(),
      herramientas: form.herramientas.split(",").map(h => h.trim()).filter(Boolean),
      observaciones: form.observaciones.trim(),
      fechaInicio: form.fechaInicio,
      fechaEntrega: form.fechaEntrega,
      versiones: form.versiones.filter(v => v.nombre.trim()),
    }
    if (isEdit) {
      await updateProject(id, editData, proyecto)
    } else {
      await updateDoc(doc(db, "companeros", id), { proyectos: arrayUnion(proyecto) })
    }
    navigate(`/colleague/${id}`)
  }

  const inputClass = "w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/30 transition-all"
  const selectClass = "bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 cursor-pointer transition-all"
  const sectionLabel = "text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4 block"

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border/60 px-6 py-3 flex justify-between items-center"
        style={{ backgroundColor: "color-mix(in srgb, var(--background) 85%, transparent)", backdropFilter: "blur(20px)" }}>
        <button onClick={() => navigate(`/colleague/${id}`)}
          className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors">
          ← Volver
        </button>
        <ThemeToggle />
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 w-full">

        <div className="mb-7">
          <h1 className="text-[26px] font-bold tracking-tight text-foreground">
            {isEdit ? "Editar proyecto" : "Nuevo proyecto"}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            {isEdit ? "Actualiza los datos del proyecto." : "Define el alcance y cronograma del proyecto."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── Sección: Identidad ── */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <span className={sectionLabel}>Identidad del proyecto</span>

            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-[13px] font-medium text-foreground mb-1.5">Nombre *</label>
                <input name="nombre" value={form.nombre} onChange={handleChange}
                  placeholder="Ej: Portal de pagos" className={inputClass} />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-foreground mb-1.5">Estado</label>
                <select name="estado" value={form.estado} onChange={handleChange}
                  className={selectClass + " w-44"}>
                  <option value="">Sin estado</option>
                  {PROJECT_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-foreground mb-1.5">Enfoque</label>
              <input list="areas-list-p" name="area" value={form.area} onChange={handleChange}
                placeholder="Ej: Robótica, Diseño UX/UI…" className={inputClass} autoComplete="off" />
              <datalist id="areas-list-p">
                {AREAS.map(a => <option key={a} value={a} />)}
              </datalist>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-foreground mb-1.5">¿Qué hace en este proyecto?</label>
              <textarea name="queHace" value={form.queHace} onChange={handleChange}
                placeholder="Ej: Desarrolla el módulo de facturación…" rows={3} className={inputClass} />
            </div>
          </div>

          {/* ── Sección: Herramientas ── */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <span className={sectionLabel}>Stack y observaciones</span>
            <div>
              <label className="block text-[13px] font-medium text-foreground mb-1.5">Herramientas usadas</label>
              <input name="herramientas" value={form.herramientas} onChange={handleChange}
                placeholder="Ej: React, Firebase (separadas por coma)" className={inputClass} />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-foreground mb-1.5">Observaciones</label>
              <textarea name="observaciones" value={form.observaciones} onChange={handleChange}
                placeholder="Algo útil que quieras recordar…" rows={3} className={inputClass} />
            </div>
          </div>

          {/* ── Sección: Cronograma ── */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <span className={sectionLabel}>Cronograma</span>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] font-medium text-foreground mb-1.5">Fecha de inicio</label>
                <input type="date" name="fechaInicio" value={form.fechaInicio} onChange={handleChange}
                  className={inputClass} />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-foreground mb-1.5">Entrega final</label>
                <input type="date" name="fechaEntrega" value={form.fechaEntrega} onChange={handleChange}
                  className={inputClass} />
              </div>
            </div>

            <div>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[13px] font-medium text-foreground">Versiones / Hitos</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Entregas intermedias, betas o fases</p>
                </div>
                <button type="button" onClick={addVersion}
                  className="text-[12px] font-semibold h-8 px-3 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all flex-shrink-0">
                  + Agregar hito
                </button>
              </div>

              {form.versiones.length === 0 && (
                <p className="text-[12px] text-muted-foreground italic">Sin hitos definidos aún.</p>
              )}

              <div className="space-y-2">
                {form.versiones.map((v, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input value={v.nombre} onChange={e => updateVersion(i, "nombre", e.target.value)}
                      placeholder="Ej: v1.0 Beta" className={inputClass} />
                    <input type="date" value={v.fecha} onChange={e => updateVersion(i, "fecha", e.target.value)}
                      className="bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 w-40 flex-shrink-0" />
                    <select value={v.estado || ""} onChange={e => updateVersion(i, "estado", e.target.value)}
                      className="bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 w-36 flex-shrink-0 cursor-pointer">
                      <option value="">Estado</option>
                      {VERSION_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button type="button" onClick={() => removeVersion(i)}
                      className="text-destructive text-xl leading-none flex-shrink-0 hover:opacity-60 px-1 transition-opacity">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="flex gap-3 pt-1">
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : isEdit ? "Actualizar proyecto" : "Guardar proyecto"}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(`/colleague/${id}`)}>Cancelar</Button>
          </div>

        </form>
      </div>
      <Footer />
    </div>
  )
}
