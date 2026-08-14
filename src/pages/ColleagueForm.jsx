import { useState, useEffect, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { doc, getDoc, addDoc, updateDoc, collection, serverTimestamp } from "firebase/firestore"
import { db } from "@/services/firebase"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import EmojiPicker from "emoji-picker-react"
import { Footer } from "@/components/ui/Footer"
import { updatePerfilProfesional } from "@/services/colleagues.service"
import { uploadPerfilFile, deletePerfilFile, uploadAvatar } from "@/services/storage.service"

const AREAS = [
  "Desarrollo de Software", "Robótica", "Inteligencia Artificial",
  "Infraestructura / DevOps", "Diseño UX/UI", "Investigación", "Soporte Técnico",
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


function hexToHue(hex) {
  if (!hex || hex.length < 7) return 165
  const r = parseInt(hex.slice(1,3), 16) / 255
  const g = parseInt(hex.slice(3,5), 16) / 255
  const b = parseInt(hex.slice(5,7), 16) / 255
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min
  if (d < 0.01) return 165
  let h = max === r ? (g-b)/d % 6 : max === g ? (b-r)/d + 2 : (r-g)/d + 4
  return Math.round(((h * 60) + 360) % 360)
}

function hueToHex(hue) {
  const h = ((hue % 360) + 360) % 360
  const l = 0.55, a = Math.min(l, 1 - l)
  const f = n => { const k = (n + h/30) % 12; return l - a * Math.max(Math.min(k-3, 9-k, 1), -1) }
  return `#${[0,8,4].map(n => Math.round(f(n)*255).toString(16).padStart(2,'0')).join('')}`
}

function hexToRgb(hex) {
  if (!hex || hex.length < 7) return { r: 0, g: 0, b: 0 }
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  }
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")}`
}

const dicebearUrl = (style, seed) =>
  `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf&backgroundType=gradientLinear`

export default function ColleagueForm() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { id, semilleroId } = useParams()
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
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
  const [avatarTab, setAvatarTab] = useState("avatar") // "foto" | "avatar"
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarUploadProgress, setAvatarUploadProgress] = useState(null)
  const [photoError, setPhotoError] = useState("")
  const [editingHex1, setEditingHex1] = useState(null)
  const notasRef = useRef(null)
  const photoFileRef = useRef(null)

  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [perfilData, setPerfilData] = useState({ hojaDeVida: null, portafolio: null, pda: null })
  const [perfilEditing, setPerfilEditing] = useState(null)
  const [perfilMode, setPerfilMode] = useState("enlace")
  const [perfilLink, setPerfilLink] = useState("")
  const [perfilFile, setPerfilFile] = useState(null)
  const [perfilProgress, setPerfilProgress] = useState(null)
  const [perfilSaving, setPerfilSaving] = useState(false)
  const [perfilError, setPerfilError] = useState("")
  const perfilFileRef = useRef(null)

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
        setPerfilData({
          hojaDeVida: d.perfilProfesional?.hojaDeVida ?? null,
          portafolio:  d.perfilProfesional?.portafolio  ?? null,
          pda:         d.perfilProfesional?.pda          ?? null,
        })
      }
    })
  }, [id, isEdit])

  const openPerfilEdit = (key) => {
    const current = perfilData[key]
    setPerfilMode(current?.storagePath ? "archivo" : "enlace")
    setPerfilLink(current?.url && !current?.storagePath ? current.url : "")
    setPerfilFile(null)
    setPerfilProgress(null)
    setPerfilError("")
    setPerfilEditing(key)
  }

  const handleSavePerfilItem = async (key) => {
    setPerfilError("")
    setPerfilSaving(true)
    try {
      let data = null
      if (perfilMode === "enlace") {
        if (!perfilLink.trim()) { setPerfilError("Ingresa un enlace válido."); setPerfilSaving(false); return }
        data = { url: perfilLink.trim(), storagePath: null }
      } else {
        if (!perfilFile) { setPerfilError("Selecciona un archivo."); setPerfilSaving(false); return }
        const old = perfilData[key]
        if (old?.storagePath) deletePerfilFile(old.storagePath).catch(() => {})
        const result = await uploadPerfilFile(id, key, perfilFile, { onProgress: setPerfilProgress })
        data = { url: result.url, nombre: result.nombre, storagePath: result.storagePath }
      }
      await updatePerfilProfesional(id, key, data)
      setPerfilData(prev => ({ ...prev, [key]: data }))
      setPerfilEditing(null)
    } catch {
      setPerfilError("Error al guardar. Intenta de nuevo.")
    } finally {
      setPerfilSaving(false)
      setPerfilProgress(null)
    }
  }

  const handleRemovePerfilItem = async (key) => {
    if (!confirm("¿Eliminar este documento del perfil?")) return
    const old = perfilData[key]
    if (old?.storagePath) deletePerfilFile(old.storagePath).catch(() => {})
    await updatePerfilProfesional(id, key, null)
    setPerfilData(prev => ({ ...prev, [key]: null }))
    if (perfilEditing === key) setPerfilEditing(null)
  }

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
        navigate(`/semillero/${semilleroId}/colleague/${id}`)
      } else {
        await addDoc(collection(db, "companeros"), { ...data, semilleroId, proyectos: [], creadoPor: user.uid, createdAt: serverTimestamp() })
        navigate(`/semillero/${semilleroId}/dashboard`)
      }
    } catch (err) {
      console.error("[Workboard] Error guardando perfil:", err.code, err.message)
      setSaveError("Sin permiso para guardar. Cierra sesión, vuelve a entrar y reintenta.")
      setSaving(false)
    }
  }

  const back = () => isEdit ? navigate(`/semillero/${semilleroId}/colleague/${id}`) : navigate(`/semillero/${semilleroId}/dashboard`)

  const handlePhotoUpload = async (file) => {
    if (!file) return
    setPhotoError("")
    setAvatarUploading(true)
    setAvatarUploadProgress(0)
    try {
      if (file.size > 5 * 1024 * 1024) {
        setPhotoError("La foto no puede superar 5 MB.")
        return
      }
      const uploadId = id || user.uid
      const { url } = await uploadAvatar(uploadId, file, { onProgress: setAvatarUploadProgress })
      setForm(f => ({ ...f, avatarUrl: url }))
      setAvatarPickerOpen(false)
    } catch (e) {
      console.error("[Workboard] Error subiendo foto:", e)
      setPhotoError("No se pudo subir la foto. Intenta de nuevo.")
    } finally {
      setAvatarUploading(false)
      setAvatarUploadProgress(null)
    }
  }

  const inputClass = "w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/30 transition-all"
  const sectionLabel = "text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4 block"

  const previewHue = form.colorHue ?? 260
  const hex1 = form.colorHue !== null ? hueToHex(form.colorHue) : null
  const rgb1 = hex1 ? hexToRgb(hex1) : { r: 54, g: 181, b: 160 }

  return (
    <div className="min-h-screen bg-background flex">

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden"
          style={{ background: "oklch(0 0 0 / 45%)", backdropFilter: "blur(2px)" }}
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 flex flex-col border-r border-border/50
          transition-transform duration-300 ease-in-out lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ width: 260, background: "var(--sidebar)" }}>

        {/* Volver */}
        <div className="px-5 pt-5 pb-4 flex-shrink-0">
          <button onClick={() => { back(); setSidebarOpen(false) }}
            className="text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            ← Volver
          </button>
        </div>

        <div className="mx-4 h-px bg-border/60 flex-shrink-0" />

        {/* Vista previa en vivo */}
        <div className="px-5 py-5 flex-shrink-0 text-center">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white font-bold text-3xl overflow-hidden mx-auto mb-3"
            style={{
              background: form.avatarUrl ? "var(--muted)" : `linear-gradient(135deg, oklch(0.68 0.18 ${previewHue}), oklch(0.54 0.22 ${(previewHue + 40) % 360}))`,
              boxShadow: `0 8px 28px oklch(0.52 0.18 ${previewHue} / 30%)`,
            }}>
            {form.avatarUrl
              ? <img src={form.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              : <span>{form.nombre?.charAt(0)?.toUpperCase() || "?"}</span>
            }
          </div>
          <p className="text-[15px] font-bold text-foreground leading-snug">
            {form.nombre || <span className="text-muted-foreground font-normal text-[13px]">Nombre del perfil</span>}
          </p>
          {form.rol && <p className="text-[12px] text-muted-foreground mt-0.5">{form.rol}</p>}
          {form.area && (
            <span className="inline-block text-[10px] font-semibold px-2.5 py-0.5 rounded-full mt-2"
              style={{ backgroundColor: `oklch(0.62 0.18 ${previewHue} / 0.12)`, color: `oklch(0.42 0.18 ${previewHue})` }}>
              {form.area}
            </span>
          )}
        </div>

        <div className="mx-4 h-px bg-border/60 flex-shrink-0" />

        {/* Perfil profesional — solo lectura */}
        {isEdit && (
          <div className="px-4 py-4 flex-1 overflow-y-auto">
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Perfil profesional</p>
            <div className="space-y-1.5">
              {[
                { key: "hojaDeVida", label: "Hoja de vida", hue: "145" },
                { key: "portafolio",  label: "Portafolio",   hue: "230" },
                { key: "pda",         label: "PDA",           hue: "55"  },
              ].map(({ key, label, hue }) => {
                const data = perfilData[key]
                return (
                  <div key={key} className="flex items-center justify-between px-2.5 py-2 rounded-lg"
                    style={{ background: "var(--muted)" }}>
                    <span className="text-[11px] font-medium text-foreground">{label}</span>
                    {data?.url
                      ? <a href={data.url} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors"
                          style={{ background: `oklch(0.62 0.18 ${hue} / 0.12)`, color: `oklch(0.48 0.18 ${hue})` }}>
                          Abrir ↗
                        </a>
                      : <span className="text-[10px] text-muted-foreground/50">—</span>
                    }
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </aside>

      {/* ── Main ── */}
      <style>{`@media (min-width: 1024px) { .cf-offset { margin-left: 260px; } }`}</style>
      <div className="cf-offset flex-1 flex flex-col min-h-screen">

        {/* Topbar */}
        <header className="sticky top-0 z-20 h-14 border-b border-border/60 px-5 flex items-center gap-3"
          style={{ backgroundColor: "color-mix(in srgb, var(--background) 85%, transparent)", backdropFilter: "blur(20px)" }}>
          <button className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors flex-shrink-0"
            onClick={() => setSidebarOpen(v => !v)}>
            <span className="text-muted-foreground font-bold text-[16px]">☰</span>
          </button>
          <div className="hidden lg:flex items-center gap-2 text-[12px]">
            <button onClick={back} className="text-muted-foreground hover:text-foreground transition-colors">
              ← {isEdit ? "Perfil" : "Equipo"}
            </button>
            <span className="text-muted-foreground">/</span>
            <span className="font-semibold text-foreground">
              {isEdit ? "Editar perfil" : "Nuevo colaborador"}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        <div className="flex-1 px-6 py-6">
          <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 items-start">

          {/* ── Columna izquierda: visual ── */}
          <div className="space-y-4">

          {/* ── Sección: Apariencia ── */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5"
            style={{ borderLeftColor: "oklch(0.52 0.13 165)", borderLeftWidth: "3px" }}>
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-medium text-foreground">Color de perfil</p>
                {form.colorHue !== null && (
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, colorHue: null }))}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                    Restablecer
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="flex-shrink-0 relative w-10 h-10 rounded-xl border-2 border-border overflow-hidden cursor-pointer hover:scale-105 transition-transform block"
                    style={{ background: hex1 ?? "var(--muted)" }}
                    title="Abrir selector de color del sistema">
                    <input type="color"
                      value={hex1 ?? "#36b5a0"}
                      onChange={e => setForm(f => ({ ...f, colorHue: hexToHue(e.target.value) }))}
                      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: "none", padding: 0 }} />
                  </label>
                  <div className="flex items-center gap-1 bg-muted/50 border border-border/60 rounded-lg px-2.5 py-1.5 flex-1">
                    <span className="text-[12px] font-mono text-muted-foreground">#</span>
                    <input type="text"
                      value={editingHex1 !== null ? editingHex1 : (hex1 ? hex1.slice(1).toUpperCase() : "")}
                      onFocus={() => setEditingHex1(hex1 ? hex1.slice(1).toUpperCase() : "")}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6).toUpperCase()
                        setEditingHex1(raw)
                        if (raw.length === 6) setForm(f => ({ ...f, colorHue: hexToHue("#" + raw) }))
                      }}
                      onBlur={() => setEditingHex1(null)}
                      maxLength={6}
                      placeholder="RRGGBB"
                      className="w-full text-[12px] font-mono bg-transparent text-foreground outline-none" />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0">{form.colorHue ?? "—"}°</span>
                </div>
                <div className="flex gap-1.5">
                  {[["R", "r"], ["G", "g"], ["B", "b"]].map(([label, ch]) => (
                    <div key={ch} className="flex-1 flex items-center gap-1.5 bg-muted/50 border border-border/60 rounded-lg px-2 py-1">
                      <span className="text-[10px] font-bold text-muted-foreground">{label}</span>
                      <input type="number" min="0" max="255"
                        value={rgb1[ch]}
                        onChange={e => {
                          const updated = { ...rgb1, [ch]: Math.max(0, Math.min(255, Number(e.target.value) || 0)) }
                          setForm(f => ({ ...f, colorHue: hexToHue(rgbToHex(updated.r, updated.g, updated.b)) }))
                        }}
                        className="w-full text-[11px] font-mono bg-transparent text-foreground outline-none" />
                    </div>
                  ))}
                </div>
                <div>
                  <div className="h-1.5 rounded-full overflow-hidden mb-1"
                    style={{ background: "linear-gradient(to right, oklch(0.62 0.20 0),oklch(0.62 0.20 60),oklch(0.62 0.20 120),oklch(0.62 0.20 180),oklch(0.62 0.20 240),oklch(0.62 0.20 300),oklch(0.62 0.20 360))" }} />
                  <style>{`.c1::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px oklch(0 0 0/30%);background:oklch(0.62 0.22 ${form.colorHue ?? 165});cursor:pointer}.c1::-moz-range-thumb{width:14px;height:14px;border-radius:50%;border:2px solid white;background:oklch(0.62 0.22 ${form.colorHue ?? 165});cursor:pointer}`}</style>
                  <input type="range" min="0" max="359" step="1" className="c1 w-full h-1.5 rounded-full appearance-none bg-transparent cursor-pointer"
                    value={form.colorHue ?? 165}
                    onChange={e => setForm(f => ({ ...f, colorHue: Number(e.target.value) }))} />
                </div>
              </div>
            </div>

            {/* Avatar */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] font-medium text-foreground">Avatar</p>
                {form.avatarUrl && (
                  <button type="button"
                    onClick={() => { setForm(f => ({ ...f, avatarUrl: null })); setAvatarPickerOpen(false) }}
                    className="text-[11px] text-destructive hover:opacity-70 transition-opacity">
                    Quitar
                  </button>
                )}
              </div>

              {/* Preview + toggle */}
              <div className="flex items-center gap-4 mb-3">
                <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 border-2 border-border flex items-center justify-center text-lg font-bold"
                  style={form.avatarUrl
                    ? { background: "var(--muted)" }
                    : { background: `linear-gradient(135deg, oklch(0.68 0.18 ${previewHue}), oklch(0.54 0.22 ${(previewHue + 40) % 360}))`, color: "#fff" }}>
                  {form.avatarUrl
                    ? <img src={form.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                    : (form.nombre?.charAt(0)?.toUpperCase() || "?")}
                </div>
                <button type="button"
                  onClick={() => setAvatarPickerOpen(v => !v)}
                  className="px-3 py-1.5 text-[12px] font-medium rounded-lg border border-border hover:bg-muted transition-colors">
                  {avatarPickerOpen ? "Cerrar" : form.avatarUrl ? "Cambiar" : "Elegir imagen"}
                </button>
              </div>

              {/* Picker expandible */}
              {avatarPickerOpen && (
                <div className="mt-1 p-4 border border-border rounded-xl bg-muted/30 space-y-3">

                  {/* Tabs: Foto / Avatar */}
                  <div className="flex gap-1 p-1 rounded-lg bg-muted/60 w-fit">
                    {[
                      { key: "foto",   label: "📸 Foto" },
                      { key: "avatar", label: "🎨 Avatar" },
                    ].map(t => (
                      <button key={t.key} type="button"
                        onClick={() => setAvatarTab(t.key)}
                        className="px-3 py-1 text-[12px] font-semibold rounded-md transition-all"
                        style={{
                          background: avatarTab === t.key ? `oklch(0.62 0.20 ${previewHue} / 0.15)` : "transparent",
                          color: avatarTab === t.key ? `oklch(0.45 0.20 ${previewHue})` : "var(--muted-foreground)",
                        }}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab: Foto */}
                  {avatarTab === "foto" && (
                    <div className="space-y-3">
                      <p className="text-[11px] text-muted-foreground">Sube una foto desde tu dispositivo (JPG, PNG, WebP — máx. 5 MB)</p>
                      <div className="flex items-center gap-3">
                        <button type="button" disabled={avatarUploading}
                          onClick={() => photoFileRef.current?.click()}
                          className="h-9 px-4 rounded-lg text-[12px] font-medium border border-border hover:bg-muted transition-colors disabled:opacity-50">
                          {avatarUploading ? `Subiendo ${avatarUploadProgress ?? 0}%` : "Seleccionar foto"}
                        </button>
                      </div>
                      {avatarUploadProgress !== null && (
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${avatarUploadProgress}%`, background: `oklch(0.52 0.13 ${previewHue})` }} />
                        </div>
                      )}
                      {photoError && (
                        <p className="text-[11px] text-destructive">{photoError}</p>
                      )}
                      <input ref={photoFileRef} type="file" className="hidden"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={e => { const f = e.target.files[0]; if (f) handlePhotoUpload(f); e.target.value = "" }} />
                    </div>
                  )}

                  {/* Tab: Avatar ilustrado */}
                  {avatarTab === "avatar" && (
                    <div className="space-y-3">
                      {/* Estilo */}
                      <div className="flex gap-2">
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
                      {/* Grid con scroll */}
                      <div className="grid grid-cols-8 gap-1.5 max-h-44 overflow-y-auto pr-1">
                        {DICEBEAR_SEEDS.map(seed => {
                          const url = dicebearUrl(dicebearStyle, seed)
                          const isSelected = form.avatarUrl === url
                          return (
                            <button key={seed} type="button"
                              onClick={() => { setForm(f => ({ ...f, avatarUrl: url })); setAvatarPickerOpen(false) }}
                              className="w-full aspect-square rounded-lg overflow-hidden transition-all hover:scale-110"
                              style={{
                                boxShadow: isSelected
                                  ? `0 0 0 2.5px oklch(0.62 0.20 ${previewHue})`
                                  : "0 1px 3px oklch(0 0 0 / 10%)",
                              }}
                              title={seed}>
                              <img src={url} alt={seed} className="w-full h-full object-cover" loading="lazy" />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Sección: Notas ── */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4"
            style={{ borderLeftColor: "oklch(0.75 0.15 80)", borderLeftWidth: "3px" }}>
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

          </div>{/* fin columna izquierda */}

          {/* ── Columna derecha: datos ── */}
          <div className="space-y-4">

          {/* ── Sección: Info básica ── */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4"
            style={{ borderLeftColor: "oklch(0.58 0.16 295)", borderLeftWidth: "3px" }}>
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
                WhatsApp <span className="text-muted-foreground font-normal"></span>
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
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4"
            style={{ borderLeftColor: "oklch(0.62 0.12 230)", borderLeftWidth: "3px" }}>
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

          {/* ── Sección: Perfil profesional ── */}
          {isEdit && (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4"
              style={{ borderLeftColor: "oklch(0.62 0.18 230)", borderLeftWidth: "3px" }}>
              <div>
                <span className={sectionLabel}>Perfil profesional</span>
                <p className="text-[12px] text-muted-foreground -mt-3">Agrega tu hoja de vida, portafolio y PDA para que el equipo los consulte.</p>
              </div>

              {[
                { key: "hojaDeVida", label: "Hoja de vida", hue: "145" },
                { key: "portafolio",  label: "Portafolio",   hue: "230" },
                { key: "pda",         label: "PDA",           hue: "55"  },
              ].map(({ key, label, hue }) => {
                const current = perfilData[key]
                const isEditingThis = perfilEditing === key

                return (
                  <div key={key} className="border border-border/50 rounded-xl p-4 space-y-3">

                    {/* Header */}
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-foreground">{label}</p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {current?.url && !isEditingThis && (
                          <>
                            <a href={current.url} target="_blank" rel="noopener noreferrer"
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors"
                              style={{ background: `oklch(0.62 0.18 ${hue} / 0.12)`, color: `oklch(0.48 0.18 ${hue})` }}>
                              Abrir ↗
                            </a>
                            <button type="button" onClick={() => openPerfilEdit(key)}
                              className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-border hover:border-primary/30 text-muted-foreground hover:text-foreground transition-colors">
                              Cambiar
                            </button>
                            <button type="button" onClick={() => handleRemovePerfilItem(key)}
                              className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-destructive/20 hover:border-destructive/40 text-destructive/70 hover:text-destructive transition-colors">
                              Quitar
                            </button>
                          </>
                        )}
                        {!current?.url && !isEditingThis && (
                          <button type="button" onClick={() => openPerfilEdit(key)}
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-dashed border-border hover:border-primary/40 text-muted-foreground hover:text-foreground transition-colors">
                            + Agregar
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Nombre guardado */}
                    {current?.url && !isEditingThis && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {current.nombre || current.url}
                      </p>
                    )}

                    {/* Formulario de edición */}
                    {isEditingThis && (
                      <div className="space-y-3 pt-1">
                        {/* Toggle modo */}
                        <div className="flex gap-1 p-1 rounded-lg bg-muted/50 w-fit">
                          {["enlace", "archivo"].map(m => (
                            <button key={m} type="button"
                              onClick={() => { setPerfilMode(m); setPerfilFile(null); setPerfilLink("") }}
                              className="px-3 py-1 text-[11px] font-semibold rounded-md transition-all"
                              style={{
                                background: perfilMode === m ? `oklch(0.62 0.18 ${hue} / 0.15)` : "transparent",
                                color: perfilMode === m ? `oklch(0.48 0.18 ${hue})` : "var(--muted-foreground)",
                              }}>
                              {m === "enlace" ? "🔗 Enlace" : "📁 Archivo"}
                            </button>
                          ))}
                        </div>

                        {perfilMode === "enlace" ? (
                          <input
                            value={perfilLink}
                            onChange={e => setPerfilLink(e.target.value)}
                            placeholder="https://drive.google.com/..."
                            className={inputClass}
                          />
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <button type="button"
                                onClick={() => perfilFileRef.current?.click()}
                                className="h-9 px-4 rounded-lg text-[12px] font-medium border border-border hover:bg-muted transition-colors">
                                📎 {perfilFile ? "Cambiar archivo" : "Seleccionar archivo"}
                              </button>
                              {perfilFile && (
                                <span className="text-[11px] text-muted-foreground truncate max-w-[180px]">{perfilFile.name}</span>
                              )}
                            </div>
                            <input ref={perfilFileRef} type="file" className="hidden"
                              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                              onChange={e => setPerfilFile(e.target.files[0] || null)} />
                            {perfilProgress !== null && (
                              <div>
                                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div className="h-full rounded-full transition-all"
                                    style={{ width: `${perfilProgress}%`, background: `oklch(0.52 0.13 ${hue})` }} />
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1">{perfilProgress}%</p>
                              </div>
                            )}
                          </div>
                        )}

                        {perfilError && <p className="text-[11px] text-destructive">{perfilError}</p>}

                        <div className="flex gap-2">
                          <button type="button" disabled={perfilSaving}
                            onClick={() => handleSavePerfilItem(key)}
                            className="h-8 px-4 text-[12px] font-semibold rounded-lg text-white disabled:opacity-50 transition-opacity"
                            style={{ background: `oklch(0.52 0.18 ${hue})` }}>
                            {perfilSaving
                              ? (perfilProgress !== null ? `Subiendo ${perfilProgress}%` : "Guardando…")
                              : "Guardar"}
                          </button>
                          <button type="button"
                            onClick={() => { setPerfilEditing(null); setPerfilFile(null); setPerfilError("") }}
                            className="h-8 px-4 text-[12px] font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Actions ── */}
          {saveError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/8 px-4 py-2.5">
              <p className="text-[12px] text-destructive">{saveError}</p>
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="h-10 px-6 rounded-xl text-[13px] font-bold text-white disabled:opacity-50 transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, oklch(0.52 0.13 165), oklch(0.44 0.14 185))", boxShadow: "0 4px 14px oklch(0.52 0.13 165 / 30%)" }}>
              {saving ? "Guardando…" : isEdit ? "Actualizar perfil" : "Guardar colaborador"}
            </button>
            <button type="button" onClick={back}
              className="h-10 px-5 rounded-xl text-[13px] font-medium border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all">
              Cancelar
            </button>
          </div>

          </div>{/* fin columna derecha */}
          </div>{/* fin grid */}

          </form>
        </div>
        <Footer />
      </div>
    </div>
  )
}
