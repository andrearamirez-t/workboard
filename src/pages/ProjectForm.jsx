import { useState } from "react"
import { useParams, useNavigate, useLocation } from "react-router-dom"
import { doc, updateDoc, arrayUnion } from "firebase/firestore"
import { db } from "@/services/firebase"
import { updateProject } from "@/services/colleagues.service"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { Footer } from "@/components/ui/Footer"

export default function ProjectForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const editData = location.state?.editProject
  const isEdit = Boolean(editData)

  const AREAS = ["Desarrollo de Software", "Robótica", "Inteligencia Artificial", "Infraestructura / DevOps", "Diseño UX/UI", "Investigación", "Soporte Técnico"]
  const PROJECT_STATES = ["Planificación", "En desarrollo", "En revisión", "Completado", "Pausado"]
  const VERSION_STATES = ["Pendiente", "En curso", "Entregado", "Cancelado"]

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

  const inputClass = "w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border px-8 py-4 flex justify-between items-center">
        <button onClick={() => navigate(`/colleague/${id}`)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Volver</button>
        <ThemeToggle />
      </header>

      <div className="max-w-2xl mx-auto px-8 py-6 w-full">
        <h1 className="text-2xl font-bold text-foreground mb-6">{isEdit ? "Editar proyecto" : "Agregar proyecto"}</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Nombre del proyecto *</label>
              <input name="nombre" value={form.nombre} onChange={handleChange} placeholder="Ej: Portal de pagos" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Estado</label>
              <select name="estado" value={form.estado} onChange={handleChange}
                className="bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer w-44">
                <option value="">Sin estado</option>
                {PROJECT_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Enfoque</label>
            <input list="areas-list-p" name="area" value={form.area} onChange={handleChange} placeholder="Ej: Robótica, Diseño UX/UI, Desarrollo de Software" className={inputClass} autoComplete="off" />
            <datalist id="areas-list-p">
              {AREAS.map(a => <option key={a} value={a} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">¿Qué hace en este proyecto?</label>
            <textarea name="queHace" value={form.queHace} onChange={handleChange} placeholder="Ej: Desarrolla el módulo de facturación..." rows={2} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Herramientas usadas</label>
            <input name="herramientas" value={form.herramientas} onChange={handleChange} placeholder="Ej: React, Firebase (separadas por coma)" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Observaciones</label>
            <textarea name="observaciones" value={form.observaciones} onChange={handleChange} placeholder="Algo útil que quieras recordar..." rows={3} className={inputClass} />
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Fecha de inicio</label>
              <input type="date" name="fechaInicio" value={form.fechaInicio} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Entrega final</label>
              <input type="date" name="fechaEntrega" value={form.fechaEntrega} onChange={handleChange} className={inputClass} />
            </div>
          </div>

          {/* Versiones / Hitos */}
          <div>
            <div className="flex justify-between items-start mb-2">
              <div>
                <label className="block text-sm font-medium text-foreground">Versiones / Hitos</label>
                <p className="text-xs text-muted-foreground mt-0.5">Entregas intermedias, betas o fases del proyecto</p>
              </div>
              <button type="button" onClick={addVersion}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all flex-shrink-0">
                + Agregar hito
              </button>
            </div>
            {form.versiones.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Sin hitos definidos.</p>
            )}
            {form.versiones.map((v, i) => (
              <div key={i} className="flex gap-2 mb-2 items-center flex-wrap sm:flex-nowrap">
                <input value={v.nombre} onChange={e => updateVersion(i, "nombre", e.target.value)}
                  placeholder="Ej: v1.0 Beta" className={inputClass} />
                <input type="date" value={v.fecha} onChange={e => updateVersion(i, "fecha", e.target.value)}
                  className="bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-40 flex-shrink-0" />
                <select value={v.estado || ""} onChange={e => updateVersion(i, "estado", e.target.value)}
                  className="bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-36 flex-shrink-0 cursor-pointer">
                  <option value="">Estado</option>
                  {VERSION_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button type="button" onClick={() => removeVersion(i)}
                  className="text-destructive text-xl leading-none flex-shrink-0 hover:opacity-70 px-1">
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving}>{saving ? "Guardando..." : isEdit ? "Actualizar proyecto" : "Guardar proyecto"}</Button>
            <Button type="button" variant="outline" onClick={() => navigate(`/colleague/${id}`)}>Cancelar</Button>
          </div>
        </form>
      </div>
      <Footer />
    </div>
  )
}
