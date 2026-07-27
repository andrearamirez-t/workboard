import * as XLSX from "xlsx"

// Normaliza nombres de columna: "Teléfono", "telefono", "TELEFONO", "whatsapp" → "telefono"
function normalizeKey(key) {
  return key
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "")
}

const NOMBRE_KEYS   = ["nombre", "name", "nombrecompleto", "estudiante", "docente", "participante"]
const TELEFONO_KEYS = ["telefono", "celular", "whatsapp", "movil", "phone", "tel"]
const CORREO_KEYS   = ["correo", "email", "correoelectronico", "correoinstitucional", "mail"]

function matchKey(raw, candidates) {
  const n = normalizeKey(raw)
  return candidates.find(c => n.includes(c))
}

export function parseContactsFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const wb = XLSX.read(data, { type: "array" })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" })

        if (rows.length === 0) { reject(new Error("El archivo está vacío.")); return }

        // Detectar columnas
        const headers = Object.keys(rows[0])
        let nombreCol = null, telefonoCol = null, correoCol = null
        for (const h of headers) {
          if (!nombreCol   && matchKey(h, NOMBRE_KEYS))   nombreCol = h
          if (!telefonoCol && matchKey(h, TELEFONO_KEYS)) telefonoCol = h
          if (!correoCol   && matchKey(h, CORREO_KEYS))   correoCol = h
        }

        if (!nombreCol && !correoCol) {
          reject(new Error("No se encontraron columnas reconocibles. Usa encabezados como: Nombre, Teléfono, Correo."))
          return
        }

        const contactos = rows
          .map(row => ({
            nombre:   nombreCol   ? String(row[nombreCol]).trim()   : "",
            telefono: telefonoCol ? String(row[telefonoCol]).trim() : "",
            correo:   correoCol   ? String(row[correoCol]).trim()   : "",
          }))
          .filter(c => c.nombre || c.correo)

        if (contactos.length === 0) {
          reject(new Error("No se encontraron filas con datos válidos."))
          return
        }

        resolve(contactos)
      } catch (err) {
        reject(new Error("No se pudo leer el archivo. Verifica que sea un Excel o CSV válido."))
      }
    }
    reader.onerror = () => reject(new Error("Error al leer el archivo."))
    reader.readAsArrayBuffer(file)
  })
}
