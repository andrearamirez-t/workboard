import { useState, useEffect, useCallback } from "react"

const STEPS = [
  {
    icon: "👋",
    title: "¡Bienvenido a Workboard!",
    desc: "Tu plataforma de seguimiento del equipo de investigación e innovación de la CUN. Te explicamos rápidamente cómo funciona.",
  },
  {
    icon: "👥",
    title: "Tu equipo",
    desc: "Aquí ves a todos tus compañeros con su rol, proyectos activos y herramientas. Haz clic en una tarjeta para entrar al perfil completo.",
    highlight: "[data-tour='cards']",
  },
  {
    icon: "🔍",
    title: "Buscar compañeros",
    desc: "Filtra por nombre, rol, herramienta o área de enfoque. El resultado se actualiza al instante.",
    highlight: "[data-tour='search']",
  },
  {
    icon: "📋",
    title: "Bitácora semanal",
    desc: "Cada compañero registra sus avances desde su propio perfil. Como admin puedes ver y gestionar todas las entradas.",
    highlight: "[data-tour='cards']",
  },
  {
    icon: "💬",
    title: "Retroalimentación",
    desc: "Los admins pueden dejar comentarios privados en el perfil de cada compañero. Solo el compañero y los admins los ven.",
  },
  {
    icon: "🔔",
    title: "Notificaciones",
    desc: "La campanita te avisa: a los admins cuando alguien llena su bitácora, y a cada compañero cuando recibe retroalimentación.",
    highlight: "[data-tour='bell']",
  },
  {
    icon: "🚀",
    title: "¡Todo listo!",
    desc: "Ya puedes usar Workboard al máximo. Si necesitas volver a ver este tutorial, haz clic en el botón ? del dashboard.",
  },
]

const STORAGE_KEY = (email) => `wb_tutorial_done_${email}`
const MODAL_W = 356
const CORNER = { position: "fixed", bottom: 24, right: 24, zIndex: 54 }

export function Tutorial({ userEmail, forceOpen = false, onClose }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState(null)

  useEffect(() => {
    if (forceOpen) { setOpen(true); setStep(0); return }
    if (userEmail && !localStorage.getItem(STORAGE_KEY(userEmail))) setOpen(true)
  }, [forceOpen, userEmail])

  useEffect(() => {
    if (!open) { setRect(null); return }
    const sel = STEPS[step].highlight
    if (!sel) { setRect(null); return }

    const el = document.querySelector(sel)
    if (!el) { setRect(null); return }

    el.scrollIntoView({ behavior: "smooth", block: "nearest" })
    const t = setTimeout(() => setRect(el.getBoundingClientRect()), 200)
    return () => clearTimeout(t)
  }, [open, step])

  const close = useCallback(() => {
    if (userEmail) localStorage.setItem(STORAGE_KEY(userEmail), "1")
    setOpen(false)
    setStep(0)
    setRect(null)
    onClose?.()
  }, [userEmail, onClose])

  const next = () => step < STEPS.length - 1 ? setStep(s => s + 1) : close()
  const prev = () => setStep(s => Math.max(0, s - 1))

  if (!open) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const dim = "oklch(0 0 0 / 0.72)"

  const card = (
    <div
      className="w-full rounded-2xl overflow-hidden"
      style={{
        width: MODAL_W,
        background: "linear-gradient(145deg, var(--card), oklch(0.16 0.05 260 / 0.97))",
        border: "1px solid oklch(0.55 0.18 260 / 0.4)",
        boxShadow: "0 28px 70px oklch(0 0 0 / 0.55), 0 0 0 1px oklch(0.55 0.18 260 / 0.2)",
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Step dots */}
      <div className="flex items-center justify-center gap-1.5 pt-5 pb-1">
        {STEPS.map((_, i) => (
          <button key={i} onClick={() => setStep(i)}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === step ? "20px" : "6px",
              height: "6px",
              background: i === step
                ? "linear-gradient(90deg, oklch(0.62 0.22 295), oklch(0.55 0.24 316))"
                : i < step
                  ? "oklch(0.62 0.18 295 / 0.5)"
                  : "oklch(0.40 0.04 260)",
            }} />
        ))}
      </div>

      <div className="px-7 py-5 text-center">
        <div className="text-5xl mb-4 leading-none select-none">{current.icon}</div>
        <h2 className="text-[18px] font-bold text-foreground mb-2 leading-snug" style={{ textWrap: "balance" }}>
          {current.title}
        </h2>
        <p className="text-[13.5px] text-muted-foreground leading-relaxed" style={{ textWrap: "balance" }}>
          {current.desc}
        </p>
        <p className="text-[11px] text-muted-foreground/40 mt-3">{step + 1} / {STEPS.length}</p>
      </div>

      <div className="px-6 pb-6 flex flex-col gap-2">
        <div className="flex gap-2.5">
          {step > 0 && (
            <button onClick={prev}
              className="flex-1 h-10 rounded-xl border border-border text-[13px] font-semibold text-muted-foreground hover:text-foreground hover:border-border/60 transition-all">
              Anterior
            </button>
          )}
          <button onClick={next}
            className="h-10 rounded-xl text-[13px] font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{
              flex: 1,
              background: "linear-gradient(135deg, oklch(0.60 0.24 295), oklch(0.50 0.26 316))",
              boxShadow: "0 4px 16px oklch(0.52 0.24 295 / 35%)",
            }}>
            {isLast ? "¡Empezar!" : "Siguiente →"}
          </button>
        </div>
        {!isLast && (
          <button onClick={close}
            className="text-[12px] text-muted-foreground hover:text-foreground transition-colors py-1">
            Saltar tutorial
          </button>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Dim backdrop */}
      <div onClick={close} style={{ position: "fixed", inset: 0, background: "oklch(0 0 0 / 0.5)", backdropFilter: "blur(4px)", zIndex: 51 }} />

      {/* Modal — always bottom-right corner */}
      <div style={CORNER}>{card}</div>
    </>
  )
}

export const resetTutorial = (email) => {
  if (email) localStorage.removeItem(STORAGE_KEY(email))
}
