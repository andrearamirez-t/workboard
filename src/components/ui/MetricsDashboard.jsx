import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from "recharts"
import { format, subWeeks, startOfWeek } from "date-fns"
import { es } from "date-fns/locale"
import { exportPDF, exportExcel } from "@/utils/exportReport"
import { useState } from "react"
import { FileDown, Sheet, ChevronDown } from "lucide-react"

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
  const [showInactive, setShowInactive] = useState(false)

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

  // ── 5. Análisis por persona (deduplicado por email, luego nombre) ──
  const _richness = c => (c.proyectos?.length || 0) * 10 + (c.herramientas?.length || 0) * 2 + (c.rol ? 5 : 0) + (c.nombre?.length || 0)
  const _byEmail  = new Map()
  const _noEmail  = []
  for (const c of colleagues) {
    const email = (c.email || "").trim().toLowerCase()
    if (email) {
      const ex = _byEmail.get(email)
      if (!ex || _richness(c) > _richness(ex)) _byEmail.set(email, c)
    } else { _noEmail.push(c) }
  }
  const _seenNames = new Set([..._byEmail.values()].map(c => (c.nombre || "").trim().toLowerCase()))
  const _deduped = [..._byEmail.values()]
  for (const c of _noEmail) {
    const nk = (c.nombre || "").trim().toLowerCase()
    if (!nk || _seenNames.has(nk)) continue
    _seenNames.add(nk); _deduped.push(c)
  }

  const personRows = _deduped
    .map(c => {
      const proyectos = c.proyectos || []
      const avg = proyectos.length
        ? Math.round(proyectos.reduce((s, p) => s + (p.avance ?? 0), 0) / proyectos.length)
        : null
      const logCount = logs.filter(l => l.colleagueId === c.id).length
      const pendientes = proyectos.filter(p => p.estado !== "Finalizado" && p.estado !== "Entregado").length
      return { ...c, proyectosCount: proyectos.length, avg, logCount, pendientes }
    })
    .sort((a, b) =>
      b.proyectosCount !== a.proyectosCount
        ? b.proyectosCount - a.proyectosCount
        : b.logCount - a.logCount
    )

  const activeRows   = personRows.filter(r => r.proyectosCount > 0 || r.logCount > 0)
  const inactiveRows = personRows
    .filter(r => r.proyectosCount === 0 && r.logCount === 0)
    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es"))

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
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
            Análisis por persona
          </p>
          <span className="text-[11px] text-muted-foreground">
            {activeRows.length} con actividad · {inactiveRows.length} sin actividad
          </span>
        </div>

        {/* Cabecera de columnas */}
        {activeRows.length > 0 && (
          <div className="flex items-center gap-3 pb-1.5 mb-1 border-b border-border/50">
            <div className="w-7 flex-shrink-0" />
            <div className="flex-1" />
            <div className="flex items-center gap-3 flex-shrink-0">
              {["Proy.", "Curso", "Notas", "Avance"].map(h => (
                <div key={h} className="text-center" style={{ width: h === "Avance" ? 64 : 36 }}>
                  <span className="text-[10px] font-semibold text-muted-foreground">{h}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filas activas */}
        {personRows.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">Sin compañeros registrados.</p>
        ) : activeRows.length === 0 ? (
          <p className="text-[12px] text-muted-foreground py-4 text-center">Nadie ha registrado proyectos o actividad aún.</p>
        ) : (
          activeRows.map(c => (
            <div key={c.id} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                style={{ background: "linear-gradient(135deg, oklch(0.52 0.13 165), oklch(0.42 0.14 185))" }}>
                {c.nombre?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[12px] font-semibold text-foreground truncate">{c.nombre}</span>
                  {c.rol && <span className="text-[10px] text-muted-foreground">{c.rol}</span>}
                </div>
                {(c.herramientas || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {(c.herramientas || []).slice(0, 4).map(t => (
                      <span key={t} className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>
                    ))}
                    {(c.herramientas || []).length > 4 && (
                      <span className="text-[9px] text-muted-foreground">+{(c.herramientas || []).length - 4}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {[{ v: c.proyectosCount }, { v: c.pendientes }, { v: c.logCount }].map((s, i) => (
                  <div key={i} className="text-center" style={{ width: 36 }}>
                    <p className="text-[14px] font-bold text-foreground leading-none">{s.v}</p>
                  </div>
                ))}
                <div style={{ width: 64 }}>
                  {c.avg !== null ? (
                    <div className="flex flex-col gap-0.5">
                      <div className="w-full h-1 rounded-full overflow-hidden bg-muted">
                        <div className="h-full rounded-full" style={{ width: `${c.avg}%`, background: avanceColor(c.avg) }} />
                      </div>
                      <p className="text-[9px] font-semibold text-right" style={{ color: avanceColor(c.avg) }}>
                        {c.avg}% · {avanceLabel(c.avg)}
                      </p>
                    </div>
                  ) : <div />}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Sin actividad — colapsable */}
        {inactiveRows.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/40">
            <button onClick={() => setShowInactive(v => !v)}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors select-none py-1 w-full text-left">
              <ChevronDown size={12} style={{ transform: showInactive ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }} />
              {inactiveRows.length} persona{inactiveRows.length !== 1 ? "s" : ""} sin proyectos ni notas registradas
            </button>
            {showInactive && (
              <div className="mt-2 overflow-y-auto" style={{ maxHeight: 220 }}>
                {inactiveRows.map(c => (
                  <div key={c.id} className="flex items-center gap-2.5 py-1.5 border-b border-border/20 last:border-0 opacity-60">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 bg-muted text-muted-foreground">
                      {c.nombre?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <span className="text-[12px] text-muted-foreground truncate flex-1">{c.nombre}</span>
                    {c.rol && <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">{c.rol}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
