import { useNavigate } from "react-router-dom"

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-muted mb-4">404</h1>
        <p className="text-muted-foreground mb-6">Esta página no existe.</p>
        <button onClick={() => navigate("/dashboard")}
          className="border border-border px-4 py-2 rounded text-sm text-foreground hover:bg-muted transition-colors">
          Volver al dashboard
        </button>
      </div>
    </div>
  )
}
