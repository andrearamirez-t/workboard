import * as XLSX from "xlsx"

function normalize(key) {
  return key
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[\s_\-/]+/g, "")
}

function match(raw, candidates) {
  const n = normalize(raw)
  return candidates.find(c => n.includes(c))
}

const COLS = {
  nombre:    ["nombreaopellido", "nombre", "name", "nombrecompleto", "estudiante", "participante", "docente"],
  email:     ["correo", "email", "correoelectronico", "mail", "correoinstitucional"],
  whatsapp:  ["numerodetelefono", "whatsapp", "telefono", "celular", "movil", "phone", "tel"],
  cedula:    ["numerodecedula", "cedula", "documento", "dni", "identificacion"],
  rh:        ["rhsanguineo", "rh", "tipodesangre", "sangre"],
  sexo:      ["sexo", "genero", "sex", "gender"],
  eps:       ["eps", "aseguradora", "entidadsalud"],
  area:      ["area", "coordinacion", "dependencia", "departamento", "facultad"],
  rol:       ["rol", "cargo", "role", "perfil"],
}

export function parseColleaguesFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const wb = XLSX.read(data, { type: "array" })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" })

        if (!rows.length) { reject(new Error("El archivo está vacío.")); return }

        // Map headers to field keys
        const headers = Object.keys(rows[0])
        const colMap = {}
        for (const h of headers) {
          for (const [field, candidates] of Object.entries(COLS)) {
            if (!colMap[field] && match(h, candidates)) colMap[field] = h
          }
        }

        if (!colMap.nombre && !colMap.email) {
          reject(new Error("No se encontraron columnas reconocibles. El archivo debe tener al menos una columna de Nombre o Correo."))
          return
        }

        const companeros = rows
          .map(row => {
            const nombre = colMap.nombre ? String(row[colMap.nombre]).trim() : ""
            const email  = colMap.email  ? String(row[colMap.email]).trim().toLowerCase() : ""
            if (!nombre && !email) return null
            const whatsapp = colMap.whatsapp ? String(row[colMap.whatsapp]).trim().replace(/\D/g, "") : ""
            const cedula   = colMap.cedula   ? String(row[colMap.cedula]).trim() : ""
            const rh       = colMap.rh       ? String(row[colMap.rh]).trim() : ""
            const sexo     = colMap.sexo     ? String(row[colMap.sexo]).trim() : ""
            const eps      = colMap.eps      ? String(row[colMap.eps]).trim() : ""
            const area     = colMap.area     ? String(row[colMap.area]).trim() : ""
            const rol      = colMap.rol      ? String(row[colMap.rol]).trim() : ""
            // Build extra notes from medical fields
            const extras = [
              cedula && `Cédula: ${cedula}`,
              rh     && `RH: ${rh}`,
              sexo   && `Sexo: ${sexo}`,
              eps    && `EPS: ${eps}`,
            ].filter(Boolean).join(" · ")
            return { nombre, email, whatsapp, area, rol, notas: extras }
          })
          .filter(Boolean)

        if (!companeros.length) {
          reject(new Error("No se encontraron filas con datos válidos."))
          return
        }
        resolve(companeros)
      } catch {
        reject(new Error("No se pudo leer el archivo. Verifica que sea un Excel (.xlsx) o CSV válido."))
      }
    }
    reader.onerror = () => reject(new Error("Error al leer el archivo."))
    reader.readAsArrayBuffer(file)
  })
}
