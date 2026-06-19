import { useState, useEffect, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { doc, getDoc, addDoc, updateDoc, collection, serverTimestamp } from "firebase/firestore"
import { db } from "@/services/firebase"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import EmojiPicker from "emoji-picker-react"
import { Footer } from "@/components/ui/Footer"

export default function ColleagueForm() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [saving, setSaving] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [form, setForm] = useState({ nombre: "", area: "", rol: "", herramientas: "", trabajaEn: "", notas: "" })
  const notasRef = useRef(null)

  const AREAS = ["Desarrollo de Software", "Robótica", "Inteligencia Artificial", "Infraestructura / DevOps", "Diseño UX/UI", "Investigación", "Soporte Técnico"]

  useEffect(() => {
    if (!isEdit) return
    getDoc(doc(db, "companeros", id)).then(snap => {
      if (snap.exists()) {
        const d = snap.data()
        setForm({ nombre: d.nombre || "", area: d.area || "", rol: d.rol || "", herramientas: (d.herramientas || []).join(", "), trabajaEn: d.trabajaEn || "", notas: d.notas || "" })
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
      nombre: form.nombre.trim(), area: form.area.trim(), rol: form.rol.trim(),
      herramientas: form.herramientas.split(",").map(h => h.trim()).filter(Boolean),
      trabajaEn: form.trabajaEn.trim(), notas: form.notas.trim(),
    }
    if (isEdit) {
      await updateDoc(doc(db, "companeros", id), { ...data, updatedAt: serverTimestamp() })
      navigate(`/colleague/${id}`)
    } else {
      await addDoc(collection(db, "companeros"), { ...data, proyectos: [], creadoPor: user.uid, createdAt: serverTimestamp() })
      navigate("/dashboard")
    }
  }

  const inputClass = "w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
  const back = () => isEdit ? navigate(`/colleague/${id}`) : navigate("/dashboard")

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border px-8 py-4 flex justify-between items-center">
        <button onClick={back} className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Volver</button>
        <ThemeToggle />
      </header>

      <div className="max-w-2xl mx-auto px-8 py-6 w-full">
        <h1 className="text-2xl font-bold text-foreground mb-6">{isEdit ? "Editar compañero" : "Agregar compañero"}</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nombre *</label>
            <input name="nombre" value={form.nombre} onChange={handleChange} placeholder="Ej: Carlos Pérez" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Enfoque</label>
            <input list="areas-list" name="area" value={form.area} onChange={handleChange} placeholder="Ej: Robótica, Diseño UX/UI, Desarrollo de Software" className={inputClass} autoComplete="off" />
            <datalist id="areas-list">
              {AREAS.map(a => <option key={a} value={a} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Rol</label>
            <input name="rol" value={form.rol} onChange={handleChange} placeholder="Ej: Frontend Developer" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Herramientas / Stack</label>
            <input name="herramientas" value={form.herramientas} onChange={handleChange} placeholder="Ej: React, Node, AWS" className={inputClass} />
            <p className="text-xs text-muted-foreground mt-1">Separadas por coma</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">¿En qué está trabajando?</label>
            <textarea name="trabajaEn" value={form.trabajaEn} onChange={handleChange} placeholder="Ej: Módulo de pagos..." rows={2} className={inputClass} />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-foreground">Notas</label>
              <button type="button" onClick={() => setShowEmoji(v => !v)}
                className="text-lg leading-none hover:scale-110 transition-transform" title="Insertar emoji">
                😊
              </button>
            </div>
            {showEmoji && (
              <div className="mb-2">
                <EmojiPicker onEmojiClick={handleEmojiClick} width="100%" height={350}
                  searchPlaceholder="Buscar emoji..." skinTonesDisabled
                  previewConfig={{ showPreview: false }} />
              </div>
            )}
            <textarea ref={notasRef} name="notas" value={form.notas} onChange={handleChange}
              placeholder="Algo útil que quieras recordar..." rows={3} className={inputClass} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving}>{saving ? "Guardando..." : isEdit ? "Actualizar" : "Guardar"}</Button>
            <Button type="button" variant="outline" onClick={back}>Cancelar</Button>
          </div>
        </form>
      </div>
      <Footer />
    </div>
  )
}
