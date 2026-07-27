// Extrae campos del PDF de propuesta CUN (formato INV-FO03)
// generado por plataforma-investigaciones-vgpt.web.app

import * as pdfjsLib from "pdfjs-dist"
import { workerSrc } from "./pdfjsWorkerUrl.js"

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

// ─── Limpieza del texto ───────────────────────────────────────────────────────

function stripCunHeaders(raw) {
  return raw
    .replace(/INV[-\s]?FO[A-Z0-9]*\s+VERS[IÓ]{1,2}N[^\n]*/gi, " ")
    .replace(/FORMATO\s+DE\s+ESTRUCTURACI[OÓ]N[^\n]*/gi, " ")
    .replace(/P[ÁA]GINA\s*:?\s*\d+\s+DE\s+\d+/gi, " ")
    .replace(/CORPORACI[OÓ]N\s+UNIVERSITARIA[^\n]*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS_ES = {
  enero: "01", febrero: "02", marzo: "03", abril: "04",
  mayo: "05", junio: "06", julio: "07", agosto: "08",
  septiembre: "09", octubre: "10", noviembre: "11", diciembre: "12",
}

function esDate(day, month, year) {
  const m = MONTHS_ES[month.toLowerCase().trim()]
  if (!m) return ""
  return `${year}-${m}-${String(day).padStart(2, "0")}`
}

function dmyToIso(d, m, y) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

// Texto que indica que el campo es una plantilla sin llenar
const TEMPLATE_PHRASES = [
  "debe redactarse",
  "máximo 200",
  "máximo 300",
  "máximo 500",
  "escriba aquí",
  "ingrese aquí",
  "describa aquí",
  "a continuación",
]

function isTemplate(str) {
  const lower = str.toLowerCase()
  return TEMPLATE_PHRASES.some(p => lower.includes(p))
}

const TECH_KEYWORDS = [
  "React", "Vue", "Angular", "Next.js", "Nuxt",
  "Firebase", "Firestore", "Supabase", "MongoDB", "MySQL", "PostgreSQL", "SQLite",
  "Node.js", "Express", "FastAPI", "Django", "Spring Boot", "Laravel",
  "Python", "JavaScript", "TypeScript", "Java", "Kotlin", "Swift", "Dart",
  "Flutter", "React Native",
  "TensorFlow", "PyTorch", "scikit-learn", "Keras",
  "Docker", "Kubernetes", "AWS", "Google Cloud", "Azure",
  "Tailwind", "Bootstrap", "Material UI",
  "GitHub", "GitLab", "Figma", "Arduino", "Raspberry Pi",
]

// ─── Parser principal ─────────────────────────────────────────────────────────

export function parseCunPdf(rawText) {
  const stripped = stripCunHeaders(rawText)
  const text = stripped.replace(/\s+/g, " ").trim()
  const result = {}

  // ── Nombre / Título ──────────────────────────────────────────────────────
  // El PDF tiene "Título de la Propuesta: Dashboard workboard"
  const titlePatterns = [
    /T[ÍI]tulo\s+de\s+la\s+Propuesta\s*:\s*([^.:\n]{3,80}?)(?=\s*(?:Este\s+documento|INVESTIGADOR|$))/i,
    /T[ÍI]TULO[^:]{0,50}:\s*([^:]{3,80}?)(?=\s*(?:INVESTIGADOR|PROGRAMA|PER[ÍI]ODO|TIPO|Este|El ob|$))/i,
    /T[ÍI]TULO[:\s]+([^\n.]{3,60})/i,
  ]
  for (const p of titlePatterns) {
    const m = text.match(p)
    if (m) {
      const candidate = m[1].trim()
        .replace(/^(de\s+la\s+)?Propuesta\s*/i, "")
        .replace(/[^\w\sáéíóúüñÁÉÍÓÚÜÑ\-(). ]/g, "")
        .trim()
      if (candidate.length >= 3 && !isTemplate(candidate)) {
        result.nombre = candidate
        break
      }
    }
  }

  // ── Período / fechas ─────────────────────────────────────────────────────

  // Patrón 1: "Del X de mes de YYYY al Y de mes de YYYY"
  const p1 = text.match(
    /[Dd]el?\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})\s+al?\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/
  )
  if (p1) {
    const fi = esDate(p1[1], p1[2], p1[3])
    const ff = esDate(p1[4], p1[5], p1[6])
    if (fi) result.fechaInicio = fi
    if (ff) result.fechaEntrega = ff
  }

  // Patrón 2: "Fecha de inicio: DD/MM/YYYY" y "Fecha de fin: DD/MM/YYYY"
  if (!result.fechaInicio) {
    const fIMatch = text.match(/[Ff]echa[^:]{0,20}[Ii]nicio[^:]*:\s*(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/)
    if (fIMatch) result.fechaInicio = dmyToIso(fIMatch[1], fIMatch[2], fIMatch[3])
  }
  if (!result.fechaEntrega) {
    const fFMatch = text.match(/[Ff]echa[^:]{0,20}(?:[Ff]in|[Tt]ermino|[Ff]inalizaci[oó]n|[Ee]ntrega)[^:]*:\s*(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/)
    if (fFMatch) result.fechaEntrega = dmyToIso(fFMatch[1], fFMatch[2], fFMatch[3])
  }

  // Patrón 3: Dos fechas DD/MM/YYYY consecutivas cerca de "Período" o "Ejecución"
  if (!result.fechaInicio || !result.fechaEntrega) {
    const periodoMatch = text.match(
      /(?:Per[ií]odo|[Ee]jecuci[oó]n)[^:]{0,30}:?\s*(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\s*(?:[-–al]+\s*)?(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/i
    )
    if (periodoMatch) {
      if (!result.fechaInicio) result.fechaInicio = dmyToIso(periodoMatch[1], periodoMatch[2], periodoMatch[3])
      if (!result.fechaEntrega) result.fechaEntrega = dmyToIso(periodoMatch[4], periodoMatch[5], periodoMatch[6])
    }
  }

  // ── Resumen → queHace ────────────────────────────────────────────────────
  const resPatterns = [
    /1\s*[.–-]\s*Resumen[:\s]+(.{50,800}?)(?=\s*2\s*[.–-]|\s*Ejes|$)/i,
    /RESUMEN[:\s]+(.{50,800}?)(?=\s*(?:OBJETIVOS|2\.|PALABRAS|$))/i,
    // Fallback: buscar en justificación u objetivo general si Resumen está vacío
    /[Jj]ustificaci[oó]n[:\s]+(.{80,600}?)(?=\s*(?:Alcance|Objetivo|$))/i,
    /[Oo]bjetivo\s+[Gg]eneral[:\s]+(.{30,300}?)(?=\s*(?:[Oo]bjetivos\s+[Ee]specíficos|$))/i,
  ]
  for (const p of resPatterns) {
    const m = text.match(p)
    if (m && m[1].trim().length > 30 && !isTemplate(m[1])) {
      result.queHace = m[1].trim().slice(0, 500)
      break
    }
  }

  // ── Enfoque / Área ───────────────────────────────────────────────────────
  const areaPatterns = [
    /PROGRAMA[^:]{0,60}:\s*([^:]{5,100}?)(?=\s*TIPO|\s*PER[IÍ]ODO|\s*INVESTIGADOR|$)/i,
    /Ejes\s+tem[aá]ticos[^:]*:\s*([^.:\n]{5,100})/i,
    /[ÁA]rea\s+de\s+[Cc]onocimiento[^:]*:\s*([^.:\n]{5,100})/i,
  ]
  for (const p of areaPatterns) {
    const m = text.match(p)
    if (m) {
      const candidate = m[1].trim()
      if (!/VERSI[ÓO]N|P[ÁA]GINA|INV-FO/i.test(candidate) && !isTemplate(candidate)) {
        result.area = candidate.slice(0, 100)
        break
      }
    }
  }

  // ── Herramientas ─────────────────────────────────────────────────────────
  const found = TECH_KEYWORDS.filter(t =>
    new RegExp(`\\b${t.replace(".", "\\.")}\\b`, "i").test(text)
  )
  if (found.length > 0) result.herramientas = found.join(", ")

  // ── Observaciones: presupuesto ───────────────────────────────────────────
  const budgetMatch = text.match(
    /PRESUPUESTO[^$\d]{0,40}(\$?\s*[\d]{1,3}(?:[.,]\d{3})+)/i
  )
  if (budgetMatch) result.observaciones = `Presupuesto total: ${budgetMatch[1].replace(/\s/g, "").trim()}`

  return result
}

// ─── Extracción de texto del PDF ─────────────────────────────────────────────
export async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
  const pdf = await loadingTask.promise

  let fullText = ""
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    // Preservar saltos de línea usando posición Y de cada elemento
    let lastY = null
    let pageText = ""
    for (const item of content.items) {
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
        pageText += "\n"
      }
      pageText += item.str
      lastY = item.transform[5]
    }
    fullText += pageText + "\n"
  }

  return fullText
}
