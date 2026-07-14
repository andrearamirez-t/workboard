const functions = require("firebase-functions")
const admin = require("firebase-admin")

admin.initializeApp()
const db = admin.firestore()

// API key: definida en functions/.env.desarrollo-investigaciones
const getKey = () => process.env.WORKBOARD_API_KEY || ""

const auth = (req) => {
  const k = req.headers["x-api-key"] || req.body?.apiKey || req.query?.apiKey
  return k && k === getKey()
}

const cors = (res) => {
  res.set("Access-Control-Allow-Origin", "*")
  res.set("Access-Control-Allow-Headers", "Content-Type, x-api-key")
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
}

// ─────────────────────────────────────────────
// POST /addLog
// Crea una entrada en bitácora desde WhatsApp
//
// Body JSON:
//   { "email": "carlos@cun.edu.co", "nota": "Avancé en el módulo X" }
// Header:
//   x-api-key: <clave>
//
// Respuesta OK:
//   { "ok": true, "logId": "abc123", "colleague": "Carlos Pérez" }
// ─────────────────────────────────────────────
exports.addLog = functions.https.onRequest(async (req, res) => {
  cors(res)
  if (req.method === "OPTIONS") return res.status(204).send("")
  if (!auth(req)) return res.status(401).json({ error: "No autorizado — revisa x-api-key" })
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" })

  const { email, whatsapp, nota } = req.body || {}
  if ((!email && !whatsapp) || !nota) {
    return res.status(400).json({ error: "Se requieren (email o whatsapp) y nota en el body" })
  }

  // Identificar compañero por whatsapp primero, luego por email
  let snap
  if (whatsapp) {
    const num = String(whatsapp).replace(/\D/g, "")
    snap = await db.collection("companeros").where("whatsapp", "==", num).limit(1).get()
    if (snap.empty) {
      return res.status(404).json({ error: `No se encontró ningún compañero con WhatsApp: ${num}` })
    }
  } else {
    snap = await db.collection("companeros")
      .where("email", "==", email.trim().toLowerCase())
      .limit(1)
      .get()
    if (snap.empty) {
      return res.status(404).json({ error: `No se encontró ningún compañero con email: ${email}` })
    }
  }

  const companeroDoc = snap.docs[0]
  const companero = companeroDoc.data()

  const logRef = await db.collection("logs").add({
    colleagueId: companeroDoc.id,
    colleagueName: companero.nombre,
    nota: nota.trim(),
    creadoPor: "whatsapp-bot",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  return res.json({ ok: true, logId: logRef.id, colleague: companero.nombre })
})

// ─────────────────────────────────────────────
// GET /getColleagues
// Devuelve lista de compañeros (id, nombre, email)
// Útil para mapear número de WhatsApp → email en n8n
//
// Header: x-api-key: <clave>
// ─────────────────────────────────────────────
exports.getColleagues = functions.https.onRequest(async (req, res) => {
  cors(res)
  if (req.method === "OPTIONS") return res.status(204).send("")
  if (!auth(req)) return res.status(401).json({ error: "No autorizado" })

  const snap = await db.collection("companeros").get()
  const colleagues = snap.docs.map(d => ({
    id: d.id,
    nombre: d.data().nombre,
    email: d.data().email || null,
    whatsapp: d.data().whatsapp || null,
  }))

  return res.json({ colleagues })
})

// ─────────────────────────────────────────────
// GET /pendingLogs
// Devuelve quiénes NO han llenado bitácora esta semana
// Ideal para el recordatorio automático de los viernes
//
// Header: x-api-key: <clave>
//
// Respuesta:
//   { "pending": [{ "nombre": "Carlos", "email": "..." }], "weekStart": "2026-07-06" }
// ─────────────────────────────────────────────
exports.pendingLogs = functions.https.onRequest(async (req, res) => {
  cors(res)
  if (req.method === "OPTIONS") return res.status(204).send("")
  if (!auth(req)) return res.status(401).json({ error: "No autorizado" })

  // Lunes de la semana actual (hora Colombia UTC-5)
  const now = new Date()
  const utcOffset = -5 * 60
  const local = new Date(now.getTime() + utcOffset * 60000)
  const day = local.getDay()
  const daysToMon = day === 0 ? 6 : day - 1
  const monday = new Date(local)
  monday.setDate(local.getDate() - daysToMon)
  monday.setHours(0, 0, 0, 0)
  const mondayUTC = new Date(monday.getTime() - utcOffset * 60000)

  const logsSnap = await db.collection("logs")
    .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(mondayUTC))
    .get()

  const logged = new Set(logsSnap.docs.map(d => d.data().colleagueId))

  const companSnap = await db.collection("companeros").get()
  const pending = companSnap.docs
    .filter(d => !logged.has(d.id))
    .map(d => ({ nombre: d.data().nombre, email: d.data().email || null }))

  return res.json({
    pending,
    total: companSnap.size,
    pendingCount: pending.length,
    weekStart: monday.toISOString().slice(0, 10),
  })
})
