import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from "recharts"
import { format, subWeeks, startOfWeek } from "date-fns"
import { es } from "date-fns/locale"
import { exportPDF, exportExcel } from "@/utils/exportReport"
import { useState } from "react"
import { FileDown, Sheet } from "lucide-react"

const OKLCH_PALETTE = [
  "#1fa882",  // teal — chart-1 (primary)
  "#7c52e0",  // violet — chart-2 (accent-secondary)
  "#d4893a",  // amber — chart-3
  "#4a80c7",  // blue — chart-4
  "#c25060",  // rose — chart-5
  "#34d399",  // emerald
  "#a78bfa",  // lavender
  "#fb923c",  // orange
]

const labelStyle = { fontSize: 11, fill: "var(--muted-foreground)" }
const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--foreground)",
}

function SectionTitle({ children }) {
  return (
    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
      {children}
    </p>
  )
}

function avanceColor(v) {
  if (v >= 75) return "#1fa882"  // success
  if (v >= 50) return "#4a80c7"  // info
  if (v >= 25) return "#d4893a"  // warning
  return "#c25060"               // destructive
}

function avanceLabel(v) {
  return v >= 75 ? "Avanzado" : v >= 50 ? "En curso" : v >= 25 ? "Inicial" : "Sin iniciar"
}

export function MetricsDashboard({ colleagues, logs }) {
  const [exporting, setExporting] = useState(null)

  const handleExport = async (type) => {
    setExporting(type)
    if (type === "pdf") exportPDF(colleagues, logs)
    else exportExcel(colleagues, logs)
    setTimeout(() => setExporting(null), 1000)
  }

  // ── 1. Estado de proyectos ──────────────────────────────────
  const stateCounts = {}
  colleagues.forEach(c =>
    (c.proyectos || []).forEach(p => {
      const s = p.estado || "Sin estado"
      stateCounts[s] = (stateCounts[s] || 0) + 1
    })
  )
  const stateData = Object.entries(stateCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }))

  // ── 2. Actividad semanal (últimas 8 semanas) ────────────────
  const now = new Date()
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = startOfWeek(subWeeks(now, 7 - i), { weekStartsOn: 1 })
    return { start, label: format(start, "d MMM", { locale: es }) }
  })
  const weekData = weeks.map(({ start, label }) => {
    const end = new Date(start.getTime() + 7 * 86400000)
    const count = logs.filter(l => {
      const d = l.createdAt?.toDate?.()
      return d && d >= start && d < end
    }).length
    return { label, notas: count }
  })

  // ── 3. Herramientas más usadas ──────────────────────────────
  const toolCounts = {}
  colleagues.forEach(c =>
    (c.herramientas || []).forEach(t => {
      toolCounts[t] = (toolCounts[t] || 0) + 1
    })
  )
  const toolData = Object.entries(toolCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }))

  // ── 4. Avance promedio por compañero ────────────────────────
  const avanceData = colleagues
    .map(c => {
      const proyectos = c.proyectos || []
      if (!proyectos.length) return null
      const avg = Math.round(proyectos.reduce((s, p) => s + (p.avance ?? 0), 0) / proyectos.length)
      return { name: c.nombre?.split(" ")[0] || "—", avg, id: c.id }
    })
    .filter(Boolean)
    .sort((a, b) => b.avg - a.avg)

  // ── Métricas generales ──────────────────────────────────────
  const totalProyectos = colleagues.reduce((s, c) => s + (c.proyectos?.length || 0), 0)
  const allAvances = colleagues.flatMap(c => (c.proyectos || []).map(p => p.avance ?? 0))
  const avgAvanceGeneral = allAvances.length
    ? Math.round(allAvances.reduce((a, b) => a + b, 0) / allAvances.length)
    : 0
  const logsUltimoMes = logs.filter(l => {
    const d = l.createdAt?.toDate?.()
    return d && d >= new Date(now.getTime() - 30 * 86400000)
  }).length
  const herramientasUnicas = new Set(colleagues.flatMap(c => c.herramientas || [])).size

  const noData = (msg) => (
    <div className="flex items-center justify-center h-32 text-[12px] text-muted-foreground">{msg}</div>
  )

  return (
    <div className="space-y-6">

      {/* ── Resumen general ─────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { value: totalProyectos, label: "Proyectos totales", hue: 295 },
          { value: `${avgAvanceGeneral}%`, label: "Avance promedio", hue: 145 },
          { value: logsUltimoMes, label: "Notas este mes", hue: 260 },
          { value: herramientasUnicas, label: "Herramientas distintas", hue: 55 },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-2xl px-4 py-3.5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-14 h-14 pointer-events-none opacity-20"
              style={{ background: `radial-gradient(circle at top right, oklch(0.65 0.18 ${s.hue}), transparent 70%)`, filter: "blur(14px)" }} />
            <p className="text-[26px] font-bold text-foreground leading-none">{s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Gráficas ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Estado de proyectos */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <SectionTitle>Estado de proyectos</SectionTitle>
          {stateData.length === 0 ? noData("Sin proyectos registrados") : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={stateData} cx="50%" cy="50%" outerRadius={72} innerRadius={36}
                  dataKey="value" paddingAngle={3}>
                  {stateData.map((_, i) => (
                    <Cell key={i} fill={OKLCH_PALETTE[i % OKLCH_PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" iconSize={8}
                  formatter={(v) => <span style={{ fontSize: 11, color: "var(--foreground)" }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Actividad semanal */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <SectionTitle>Actividad en bitácora (8 semanas)</SectionTitle>
          {logs.length === 0 ? noData("Sin notas en bitácora") : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weekData} barSize={18}>
                <XAxis dataKey="label" tick={labelStyle} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={labelStyle} axisLine={false} tickLine={false} width={24} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "oklch(0.55 0.18 260 / 0.08)" }} />
                <Bar dataKey="notas" name="Notas" fill="#a78bfa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Herramientas más usadas */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <SectionTitle>Herramientas más usadas</SectionTitle>
          {toolData.length === 0 ? noData("Sin herramientas registradas") : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={toolData} layout="vertical" barSize={12}>
                <XAxis type="number" allowDecimals={false} tick={labelStyle} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={90} tick={labelStyle} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "oklch(0.55 0.18 260 / 0.08)" }} />
                <Bar dataKey="count" name="Personas" radius={[0, 4, 4, 0]}>
                  {toolData.map((_, i) => (
                    <Cell key={i} fill={OKLCH_PALETTE[i % OKLCH_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Avance promedio */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <SectionTitle>Avance promedio por persona</SectionTitle>
          {avanceData.length === 0 ? noData("Sin proyectos con avance registrado") : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={avanceData} layout="vertical" barSize={12}>
                <XAxis type="number" domain={[0, 100]} tick={labelStyle} axisLine={false} tickLine={false}
                  tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="name" width={72} tick={labelStyle} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}%`, "Avance"]}
                  cursor={{ fill: "oklch(0.55 0.18 260 / 0.08)" }} />
                <Bar dataKey="avg" name="Avance" radius={[0, 4, 4, 0]}>
                  {avanceData.map((d, i) => (
                    <Cell key={i} fill={avanceColor(d.avg)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Análisis por persona ─────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <SectionTitle>Análisis por persona</SectionTitle>
        <div className="space-y-3">
          {colleagues.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Sin compañeros registrados.</p>
          ) : (
            colleagues.map(c => {
              const proyectos = c.proyectos || []
              const avg = proyectos.length
                ? Math.round(proyectos.reduce((s, p) => s + (p.avance ?? 0), 0) / proyectos.length)
                : null
              const logCount = logs.filter(l => l.colleagueId === c.id).length
              const tools = (c.herramientas || []).slice(0, 5)
              const pendientes = proyectos.filter(p => p.estado !== "Finalizado" && p.estado !== "Entregado").length
              return (
                <div key={c.id} className="flex flex-col sm:flex-row sm:items-center gap-3 py-3 border-b border-border/50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] font-semibold text-foreground">{c.nombre}</p>
                      <span className="text-[11px] text-muted-foreground">{c.rol || "Sin rol"}</span>
                    </div>
                    {tools.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {tools.map(t => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>
                        ))}
                        {(c.herramientas || []).length > 5 && (
                          <span className="text-[10px] text-muted-foreground px-1">+{c.herramientas.length - 5}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0 text-[12px]">
                    <div className="text-center">
                      <p className="font-bold text-foreground text-[18px] leading-none">{proyectos.length}</p>
                      <p className="text-muted-foreground text-[10px]">proyectos</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-foreground text-[18px] leading-none">{pendientes}</p>
                      <p className="text-muted-foreground text-[10px]">en curso</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-foreground text-[18px] leading-none">{logCount}</p>
                      <p className="text-muted-foreground text-[10px]">notas</p>
                    </div>
                    {avg !== null && (
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "oklch(0.40 0.02 260 / 0.3)" }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${avg}%`, background: avanceColor(avg) }} />
                        </div>
                        <p className="text-[10px] font-medium" style={{ color: avanceColor(avg) }}>
                          {avg}% · {avanceLabel(avg)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── Exportar reporte ─────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <SectionTitle>Exportar reporte</SectionTitle>
        <p className="text-[12px] text-muted-foreground mb-4">
          El reporte incluye el equipo, proyectos con avance, bitácora y métricas generales.
        </p>
        <div className="flex gap-3">
          <button onClick={() => handleExport("pdf")} disabled={!!exporting}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-medium border border-border text-foreground hover:bg-muted transition-all disabled:opacity-40">
            <FileDown size={14} />
            {exporting === "pdf" ? "Generando…" : "Descargar PDF"}
          </button>
          <button onClick={() => handleExport("xlsx")} disabled={!!exporting}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-medium border border-border text-foreground hover:bg-muted transition-all disabled:opacity-40">
            <Sheet size={14} />
            {exporting === "xlsx" ? "Generando…" : "Descargar Excel"}
          </button>
        </div>
      </div>

    </div>
  )
}
