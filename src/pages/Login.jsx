import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/ThemeToggle"

export default function Login() {
  const { user, loading, loginWithGoogle, authError } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true })
  }, [user, loading, navigate])

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">

      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, oklch(0.62 0.24 295), transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, oklch(0.60 0.20 316), transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, oklch(0.52 0.22 290), transparent 60%)", filter: "blur(80px)" }} />
      </div>

      {/* Theme toggle */}
      <div className="relative z-10 flex justify-end p-4">
        <ThemeToggle />
      </div>

      {/* Card */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm animate-scale-in">
          <div className="bg-card border border-border rounded-3xl p-8 space-y-7"
            style={{ boxShadow: "0 24px 64px oklch(0.52 0.22 295 / 14%), 0 0 0 1px oklch(0.60 0.18 290 / 8%)" }}>

            {/* Logo + title */}
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-white text-2xl font-bold"
                style={{
                  background: "linear-gradient(140deg, oklch(0.62 0.24 295), oklch(0.50 0.26 316))",
                  boxShadow: "0 8px 24px oklch(0.52 0.24 295 / 40%)",
                }}>
                W
              </div>
              <div>
                <h1 className="text-[24px] font-bold tracking-tight text-foreground">Workboard</h1>
                <p className="text-[13px] text-muted-foreground mt-0.5">Tu radar de equipo interno</p>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Auth */}
            <div className="space-y-3">
              <Button onClick={loginWithGoogle} size="lg" className="w-full rounded-xl text-[14px] h-11">
                Entrar con Google
              </Button>
              {authError && (
                <p className="text-xs text-destructive text-center">{authError}</p>
              )}
              <p className="text-[11px] text-muted-foreground text-center">Acceso restringido · Solo cuentas autorizadas</p>
            </div>

          </div>
        </div>
      </div>

    </div>
  )
}
