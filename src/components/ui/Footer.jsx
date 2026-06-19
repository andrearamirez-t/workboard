export function Footer() {
  return (
    <footer className="mt-auto px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="h-px mb-6"
          style={{ background: "linear-gradient(90deg, transparent, oklch(0.52 0.22 295 / 28%), oklch(0.55 0.18 316 / 28%), transparent)" }} />
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[11px] font-bold select-none"
              style={{
                background: "linear-gradient(140deg, oklch(0.60 0.24 295), oklch(0.50 0.26 316))",
                boxShadow: "0 2px 8px oklch(0.52 0.24 295 / 30%)",
              }}>
              W
            </div>
            <span className="text-[13px] font-semibold text-foreground tracking-tight">Workboard</span>
          </div>
          <p className="text-[11px] text-muted-foreground">Todos los derechos reservados &copy; 2026</p>
        </div>
      </div>
    </footer>
  )
}
