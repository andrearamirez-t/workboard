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

const COLOR_SWATCHES = [
  { hue: 295, label: "Morado" },
  { hue: 260, label: "Índigo" },
  { hue: 220, label: "Azul" },
  { hue: 195, label: "Cian" },
  { hue: 165, label: "Esmeralda" },
  { hue: 145, label: "Verde" },
  { hue: 95,  label: "Lima" },
  { hue: 65,  label: "Amarillo" },
  { hue: 45,  label: "Naranja" },
  { hue: 27,  label: "Rojo" },
  { hue: 340, label: "Rosa" },
  { hue: 320, label: "Fucsia" },
]

const DICEBEAR_STYLES = [
  { key: "adventurer-neutral", label: "Ilustrado" },
  { key: "bottts-neutral",     label: "Robot" },
  { key: "fun-emoji",          label: "Fun" },
]

const DICEBEAR_SEEDS = [
  "Aria","Blaze","Cleo","Dash","Ember","Finn","Gale","Haze",
  "Iris","Juno","Koda","Luna","Milo","Nova","Opal","Pax",
  "Quinn","Rio","Sage","Tavi","Uma","Vale","Wren","Zoe",
]


const dicebearUrl = (style, seed) =>
  `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf&backgroundType=gradientLinear`

export default function ColleagueForm() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [form, setForm] = useState({
    nombre: "", email: "", whatsapp: "", area: "", rol: "",
    herramientas: "", trabajaEn: "", notas: "",
    colorHue: null, avatarUrl: null,
  })
  const [dicebearStyle, setDicebearStyle] = useState("adventurer-neutral")
  const notasRef = useRef(null)

  useEffect(() => {
    if (!isEdit) return
    getDoc(doc(db, "companeros", id)).then(snap => {
      if (snap.exists()) {
        const d = snap.data()
        setForm({
          nombre: d.nombre || "",
          email: d.email || "",
          whatsapp: d.whatsapp || "",
          area: d.area || "",
          rol: d.rol || "",
          herramientas: (d.herramientas || []).join(", "),
          trabajaEn: d.trabajaEn || "",
          notas: d.notas || "",
          colorHue: d.colorHue ?? null,
          avatarUrl: d.avatarUrl ?? null,
        })
        if (d.avatarUrl?.includes("dicebear.com")) {
          const match = d.avatarUrl.match(/9\.x\/([^/]+)\/svg/)
          if (match) setDicebearStyle(match[1])
        }
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
    setSaveError(null)

    const data = {
      nombre: form.nombre.trim(),
      email: form.email.trim().toLowerCase(),
      whatsapp: form.whatsapp.trim().replace(/\D/g, ""),
      area: form.area.trim(),
      rol: form.rol.trim(),
      herramientas: form.herramientas.split(",").map(h => h.trim()).filter(Boolean),
      trabajaEn: form.trabajaEn.trim(),
      notas: form.notas.trim(),
      colorHue: form.colorHue,
      avatarUrl: form.avatarUrl,
    }

    try {
      if (isEdit) {
        await updateDoc(doc(db, "companeros", id), { ...data, updatedAt: serverTimestamp() })
        navigate(`/colleague/${id}`)
      } else {
        await addDoc(collection(db, "companeros"), { ...data, proyectos: [], creadoPor: user.uid, createdAt: serverTimestamp() })
        navigate("/dashboard")
      }
    } catch (err) {
      console.error("[Workboard] Error guardando perfil:", err.code, err.message)
      setSaveError("Sin permiso para guardar. Cierra sesión, vuelve a entrar y reintenta.")
      setSaving(false)
    }
  }

  const back = () => isEdit ? navigate(`/colleague/${id}`) : navigate("/dashboard")

  const inputClass = "w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/30 transition-all"
  const sectionLabel = "text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4 block"

  const previewHue = form.colorHue ?? 260

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
            {isEdit ? "Editar perfil" : "Nuevo compañero"}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            {isEdit ? "Actualiza los datos de tu perfil." : "Completa la información para agregar al equipo."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── Sección: Apariencia ── */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <span className={sectionLabel}>Apariencia del perfil</span>

            {/* Preview */}
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl flex-shrink-0 flex items-center justify-center text-white font-bold text-3xl overflow-hidden"
                style={{
                  background: form.avatarUrl
                    ? "transparent"
                    : `linear-gradient(135deg, oklch(0.68 0.18 ${previewHue}), oklch(0.54 0.22 ${(previewHue + 40) % 360}))`,
                  boxShadow: `0 8px 24px oklch(0.55 0.20 ${previewHue} / 35%)`,
                }}>
                {form.avatarUrl
                  ? <img src={form.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                  : <span>{form.nombre?.charAt(0)?.toUpperCase() || "?"}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-foreground truncate">{form.nombre || "Tu nombre"}</p>
                <p className="text-[12px] text-muted-foreground">{form.rol || "Rol sin definir"}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{form.area || ""}</p>
              </div>
            </div>

            {/* Color */}
            <div>
              <p className="text-[13px] font-medium text-foreground mb-2.5">Color de perfil</p>
              <div className="flex flex-wrap gap-2.5">
                {COLOR_SWATCHES.map(({ hue, label }) => (
                  <button key={hue} type="button" title={label}
                    onClick={() => setForm(f => ({ ...f, colorHue: hue }))}
                    className="relative w-9 h-9 rounded-full transition-all hover:scale-110 focus:outline-none"
                    style={{
                      background: `linear-gradient(135deg, oklch(0.68 0.20 ${hue}), oklch(0.52 0.24 ${(hue + 30) % 360}))`,
                      boxShadow: form.colorHue === hue
                        ? `0 0 0 3px var(--background), 0 0 0 5px oklch(0.62 0.22 ${hue})`
                        : "0 2px 6px oklch(0 0 0 / 20%)",
                    }}>
                    {form.colorHue === hue && (
                      <svg className="absolute inset-0 m-auto" width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2.5 7l3 3 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                ))}
                {form.colorHue !== null && (
                  <button type="button" onClick={() => setForm(f => ({ ...f, colorHue: null }))}
                    className="w-9 h-9 rounded-full border-2 border-dashed border-border text-muted-foreground text-[11px] font-bold hover:border-foreground transition-colors"
                    title="Color automático">
                    A
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                {form.colorHue !== null ? "Color seleccionado" : "Color automático (basado en tu perfil)"}
              </p>
            </div>

            {/* Avatar — solo caricaturas DiceBear */}
            <div>
              <p className="text-[13px] font-medium text-foreground mb-3">Avatar</p>

              {/* Selector de estilo */}
              <div className="flex flex-wrap gap-2 mb-4">
                {DICEBEAR_STYLES.map(s => (
                  <button key={s.key} type="button"
                    onClick={() => setDicebearStyle(s.key)}
                    className="px-3 py-1 text-[12px] font-semibold rounded-lg border transition-all"
                    style={{
                      borderColor: dicebearStyle === s.key ? `oklch(0.62 0.20 ${previewHue})` : "var(--border)",
                      background: dicebearStyle === s.key ? `oklch(0.62 0.20 ${previewHue} / 0.12)` : "transparent",
                      color: dicebearStyle === s.key ? "var(--foreground)" : "var(--muted-foreground)",
                    }}>
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Grilla de avatares */}
              <div className="grid grid-cols-6 gap-2">
                {DICEBEAR_SEEDS.map(seed => {
                  const url = dicebearUrl(dicebearStyle, seed)
                  const isSelected = form.avatarUrl === url
                  return (
                    <button key={seed} type="button"
                      onClick={() => setForm(f => ({ ...f, avatarUrl: url }))}
                      className="w-full aspect-square rounded-xl overflow-hidden transition-all hover:scale-105"
                      style={{
                        boxShadow: isSelected
                          ? `0 0 0 3px oklch(0.62 0.20 ${previewHue})`
                          : "0 1px 4px oklch(0 0 0 / 12%)",
                      }}
                      title={seed}>
                      <img src={url} alt={seed} className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  )
                })}
              </div>

              {form.avatarUrl && (
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, avatarUrl: null }))}
                  className="mt-3 text-[12px] text-destructive hover:opacity-70 transition-opacity">
                  Quitar avatar
                </button>
              )}
            </div>
          </div>

          {/* ── Sección: Info básica ── */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <span className={sectionLabel}>Información básica</span>
            <div>
              <label className="block text-[13px] font-medium text-foreground mb-1.5">Nombre *</label>
              <input name="nombre" value={form.nombre} onChange={handleChange}
                placeholder="Ej: Carlos Pérez" className={inputClass} />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-foreground mb-1.5">
                Correo institucional <span className="text-muted-foreground font-normal">(cuenta Google @cun.edu.co)</span>
              </label>
              <input name="email" type="email" value={form.email} onChange={handleChange}
                placeholder="Ej: carlos_perez@cun.edu.co" className={inputClass} />
              <p className="text-[11px] text-muted-foreground mt-1.5">Necesario para que la persona pueda editar su propio perfil.</p>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-foreground mb-1.5">
                WhatsApp <span className="text-muted-foreground font-normal">(con código de país, sin +)</span>
              </label>
              <input name="whatsapp" type="tel" value={form.whatsapp} onChange={handleChange}
                placeholder="Ej: 573221234567" className={inputClass} />
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
          {saveError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/8 px-4 py-2.5">
              <p className="text-[12px] text-destructive">{saveError}</p>
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : isEdit ? "Actualizar perfil" : "Guardar compañero"}
            </Button>
            <Button type="button" variant="outline" onClick={back}>Cancelar</Button>
          </div>

        </form>
      </div>
      <Footer />
    </div>
  )
}
