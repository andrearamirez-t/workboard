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
    <div className="min-h-screen flex flex-col bg-background"
      style={{ background: "radial-gradient(ellipse at top left, oklch(0.92 0.06 290 / 40%), transparent 55%), radial-gradient(ellipse at bottom right, oklch(0.90 0.05 320 / 30%), transparent 55%)" }}>
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="bg-card border border-border rounded-3xl p-8 shadow-xl text-center space-y-6"
            style={{ boxShadow: "0 20px 60px oklch(0.52 0.18 290 / 15%)" }}>

            <div className="space-y-2">
              <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-white text-2xl font-bold"
                style={{ background: "linear-gradient(135deg, oklch(0.65 0.16 290), oklch(0.55 0.18 320))" }}>
                W
              </div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight pt-1">Workboard</h1>
              <p className="text-muted-foreground text-sm">Tu radar de equipo</p>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-3">
              <Button onClick={loginWithGoogle} size="lg" className="w-full rounded-xl">
                Entrar con Google
              </Button>
              {authError && (
                <p className="text-xs text-destructive">{authError}</p>
              )}
              <p className="text-xs text-muted-foreground">Acceso restringido</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
