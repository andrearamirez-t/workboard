import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { ThemeToggle } from "@/components/ui/ThemeToggle"

export default function Login() {
  const { user, loading, loginWithGoogle, authError } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true })
  }, [user, loading, navigate])

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">

      {/* Grid background */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          opacity: 0.4,
        }} />

      {/* Radial overlay que oculta el grid en el centro */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 70% at 50% 50%, transparent 30%, var(--background) 75%)" }} />

      {/* Color blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-25"
          style={{ background: "radial-gradient(circle, oklch(0.60 0.24 295), transparent 65%)", filter: "blur(80px)" }} />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full opacity-18"
          style={{ background: "radial-gradient(circle, oklch(0.55 0.22 316), transparent 65%)", filter: "blur(80px)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full opacity-8"
          style={{ background: "radial-gradient(circle, oklch(0.50 0.20 280), transparent 55%)", filter: "blur(100px)" }} />
      </div>

      {/* Theme toggle */}
      <div className="relative z-10 flex justify-end p-4">
        <ThemeToggle />
      </div>

      {/* Card */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-[360px] animate-scale-in">

          {/* Outer glow ring */}
          <div className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{ background: "oklch(0.55 0.22 295 / 0.12)", filter: "blur(32px)", transform: "scale(1.08)" }} />

          <div className="relative bg-card border border-border rounded-3xl p-8 space-y-7"
            style={{ boxShadow: "0 32px 80px oklch(0.52 0.22 295 / 16%), 0 0 0 1px oklch(0.60 0.18 290 / 10%)" }}>

            {/* Top accent line */}
            <div className="absolute top-0 left-8 right-8 h-px rounded-full"
              style={{ background: "linear-gradient(90deg, transparent, oklch(0.65 0.20 295 / 0.6), transparent)" }} />

            {/* Logo + title */}
            <div className="text-center space-y-4">
              <div className="relative mx-auto w-fit">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-3xl font-bold"
                  style={{
                    background: "linear-gradient(140deg, oklch(0.62 0.24 295), oklch(0.50 0.26 316))",
                    boxShadow: "0 12px 32px oklch(0.52 0.24 295 / 45%)",
                  }}>
                  W
                </div>
                {/* Glow behind logo */}
                <div className="absolute -inset-2 rounded-3xl -z-10"
                  style={{ background: "oklch(0.60 0.22 295 / 0.20)", filter: "blur(16px)" }} />
              </div>
              <div>
                <h1 className="text-[26px] font-bold tracking-tight text-foreground">Workboard</h1>
                <p className="text-[13px] text-muted-foreground mt-0.5">Semillero de investigaciones · CUN</p>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Auth */}
            <div className="space-y-3">
              <button onClick={loginWithGoogle}
                className="w-full h-11 rounded-xl text-[14px] font-semibold text-white relative overflow-hidden group transition-all"
                style={{
                  background: "linear-gradient(135deg, oklch(0.58 0.22 295), oklch(0.50 0.24 316))",
                  boxShadow: "0 8px 24px oklch(0.52 0.22 295 / 35%)",
                }}>
                {/* Shine sweep on hover */}
                <span className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
                  style={{ background: "linear-gradient(105deg, transparent 30%, oklch(1 0 0 / 0.15) 50%, transparent 70%)" }} />
                <span className="relative flex items-center justify-center gap-2.5">
                  {/* Google icon */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="rgba(255,255,255,0.9)"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="rgba(255,255,255,0.9)"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="rgba(255,255,255,0.9)"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="rgba(255,255,255,0.9)"/>
                  </svg>
                  Continuar con Google
                </span>
              </button>

              {authError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/8 px-4 py-2.5">
                  <p className="text-[12px] text-destructive text-center">{authError}</p>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                Acceso restringido · Solo cuentas <span className="font-semibold">@cun.edu.co</span>
              </p>
            </div>

          </div>
        </div>
      </div>

    </div>
  )
}
