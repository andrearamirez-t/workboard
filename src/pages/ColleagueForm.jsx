import { useState, useEffect, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { doc, getDoc, addDoc, updateDoc, collection, serverTimestamp } from "firebase/firestore"
import { db } from "@/services/firebase"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import EmojiPicker from "emoji-picker-react"
import { Footer } from "@/components/ui/Footer"

const AREAS = [
  "Desarrollo de Software", "Robótica", "Inteligencia Artificial",
  "Infraestructura / DevOps", "Diseño UX/UI", "Investigación", "Soporte Técnico",
]

export default function ColleagueForm() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [saving, setSaving] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [form, setForm] = useState({ nombre: "", area: "", rol: "", herramientas: "", trabajaEn: "", notas: "" })
  const notasRef = useRef(null)

  useEffect(() => {
    if (!isEdit) return
    getDoc(doc(db, "companeros", id)).then(snap => {
      if (snap.exists()) {
        const d = snap.data()
        setForm({
          nombre: d.nombre || "",
          area: d.area || "",
          rol: d.rol || "",
          herramientas: (d.herramientas || []).join(", "),
          trabajaEn: d.trabajaEn || "",
          notas: d.notas || "",
        })
      }
    })
  }, [id, isEdit])

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleEmojiClick = (emojiData) => {
    const el = notasRef.current
    const start = el.selectionStart
    const end = el.selectionEnd
    const newText = form.notas.substring(0, start) + emojiData.emoji + form.notas.substring(end)
    setForm({ ...form, notas: newText })
    setShowEmoji(false)
    setTimeout(() => {
      el.focus()
      el.selectionStart = start + emojiData.emoji.length
      el.selectionEnd = start + emojiData.emoji.length
    }, 0)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim()) return
    setSaving(true)
    const data = {
      nombre: form.nombre.trim(),
      area: form.area.trim(),
      rol: form.rol.trim(),
      herramientas: form.herramientas.split(",").map(h => h.trim()).filter(Boolean),
      trabajaEn: form.trabajaEn.trim(),
      notas: form.notas.trim(),
    }
    if (isEdit) {
      await updateDoc(doc(db, "companeros", id), { ...data, updatedAt: serverTimestamp() })
      navigate(`/colleague/${id}`)
    } else {
      await addDoc(collection(db, "companeros"), { ...data, proyectos: [], creadoPor: user.uid, createdAt: serverTimestamp() })
      navigate("/dashboard")
    }
  }

  const back = () => isEdit ? navigate(`/colleague/${id}`) : navigate("/dashboard")

  const inputClass = "w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/30 transition-all"
  const sectionLabel = "text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4 block"

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border/60 px-6 py-3 flex justify-between items-center"
        style={{ backgroundColor: "color-mix(in srgb, var(--background) 85%, transparent)", backdropFilter: "blur(20px)" }}>
        <button onClick={back}
          className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          ← Volver
        </button>
        <ThemeToggle />
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 w-full">

        <div className="mb-7">
          <h1 className="text-[26px] font-bold tracking-tight text-foreground">
            {isEdit ? "Editar compañero" : "Nuevo compañero"}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            {isEdit ? "Actualiza los datos del perfil." : "Completa la información para agregar al equipo."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── Sección: Info básica ── */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <span className={sectionLabel}>Información básica</span>
            <div>
              <label className="block text-[13px] font-medium text-foreground mb-1.5">Nombre *</label>
              <input name="nombre" value={form.nombre} onChange={handleChange}
                placeholder="Ej: Carlos Pérez" className={inputClass} />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-foreground mb-1.5">Rol</label>
              <input name="rol" value={form.rol} onChange={handleChange}
                placeholder="Ej: Frontend Developer" className={inputClass} />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-foreground mb-1.5">Enfoque</label>
              <input list="areas-list" name="area" value={form.area} onChange={handleChange}
                placeholder="Ej: Robótica, Diseño UX/UI…" className={inputClass} autoComplete="off" />
              <datalist id="areas-list">
                {AREAS.map(a => <option key={a} value={a} />)}
              </datalist>
            </div>
          </div>

          {/* ── Sección: Stack y trabajo ── */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <span className={sectionLabel}>Stack y contexto</span>
            <div>
              <label className="block text-[13px] font-medium text-foreground mb-1.5">Herramientas / Stack</label>
              <input name="herramientas" value={form.herramientas} onChange={handleChange}
                placeholder="Ej: React, Node, AWS (separadas por coma)" className={inputClass} />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-foreground mb-1.5">¿En qué está trabajando?</label>
              <textarea name="trabajaEn" value={form.trabajaEn} onChange={handleChange}
                placeholder="Ej: Módulo de pagos del portal…" rows={3} className={inputClass} />
            </div>
          </div>

          {/* ── Sección: Notas ── */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className={sectionLabel + " mb-0"}>Notas</span>
              <button type="button" onClick={() => setShowEmoji(v => !v)}
                className="text-lg leading-none hover:scale-110 transition-transform" title="Insertar emoji">
                😊
              </button>
            </div>
            {showEmoji && (
              <div className="rounded-xl overflow-hidden">
                <EmojiPicker onEmojiClick={handleEmojiClick} width="100%" height={320}
                  searchPlaceholder="Buscar emoji…" skinTonesDisabled
                  previewConfig={{ showPreview: false }} />
              </div>
            )}
            <textarea ref={notasRef} name="notas" value={form.notas} onChange={handleChange}
              placeholder="Algo útil que quieras recordar…" rows={4} className={inputClass} />
          </div>

          {/* ── Actions ── */}
          <div className="flex gap-3 pt-1">
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : isEdit ? "Actualizar" : "Guardar compañero"}
            </Button>
            <Button type="button" variant="outline" onClick={back}>Cancelar</Button>
          </div>

        </form>
      </div>
      <Footer />
    </div>
  )
}
