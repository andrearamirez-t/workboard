export function Footer() {
  return (
    <footer className="mt-auto px-8 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="h-px mb-6"
          style={{ background: "linear-gradient(90deg, transparent, oklch(0.52 0.18 290 / 35%), oklch(0.55 0.18 320 / 35%), transparent)" }} />
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold select-none"
              style={{ background: "linear-gradient(135deg, oklch(0.65 0.16 290), oklch(0.55 0.18 320))", boxShadow: "0 2px 8px oklch(0.52 0.18 290 / 30%)" }}>
              W
            </div>
            <span className="text-sm font-semibold text-foreground tracking-tight">Workboard</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Todos los derechos reservados &copy; 2026
          </p>
        </div>
      </div>
    </footer>
  )
}
