import { useState, useEffect, useRef } from "react"
import { Bell } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { collection, query, orderBy, onSnapshot } from "firebase/firestore"
import { db } from "@/services/firebase"

const storageKey = (type, id) => `wb_read_${type}_${id}`

const getReadIds = (key) => {
  try { return new Set(JSON.parse(localStorage.getItem(key) || "[]")) }
  catch { return new Set() }
}

const saveReadIds = (key, set) => {
  localStorage.setItem(key, JSON.stringify([...set]))
}

export function NotificationBell({ isAdmin, myColleagueId, userEmail }) {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const key = isAdmin
    ? storageKey("logs", userEmail)
    : storageKey("fb", myColleagueId)

  // ── Listener en tiempo real ─────────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin && !myColleagueId) return

    let q
    if (isAdmin) {
      q = query(collection(db, "logs"), orderBy("createdAt", "desc"))
    } else {
      q = query(
        collection(db, "companeros", myColleagueId, "retroalimentacion"),
        orderBy("createdAt", "desc")
      )
    }

    const unsub = onSnapshot(q, (snap) => {
      const readIds = getReadIds(key)
      const fresh = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(doc => !readIds.has(doc.id))
        .map(doc => isAdmin
          ? {
              id: doc.id,
              text: `${doc.colleagueName || "Alguien"} agregó una nota`,
              sub: doc.nota?.slice(0, 70) + (doc.nota?.length > 70 ? "…" : ""),
              date: doc.createdAt?.toDate?.(),
              href: `/colleague/${doc.colleagueId}`,
            }
          : {
              id: doc.id,
              text: `${doc.creadoPorNombre || "Admin"} te dejó retroalimentación`,
              sub: doc.texto?.slice(0, 70) + (doc.texto?.length > 70 ? "…" : ""),
              date: doc.createdAt?.toDate?.(),
              href: `/colleague/${myColleagueId}`,
            }
        )
      setItems(fresh)
    }, () => { /* sin permiso — ignora */ })

    return () => unsub()
  }, [isAdmin, myColleagueId, key])

  const markOne = (id) => {
    const readIds = getReadIds(key)
    readIds.add(id)
    saveReadIds(key, readIds)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const markAll = () => {
    const readIds = getReadIds(key)
    items.forEach(i => readIds.add(i.id))
    saveReadIds(key, readIds)
    setItems([])
  }

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const count = items.length

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
        title={isAdmin ? "Actividad del equipo" : "Mis notificaciones"}
      >
        <Bell size={16} className={count > 0 ? "text-foreground" : "text-muted-foreground"} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
            style={{ backgroundColor: "oklch(0.60 0.22 27)" }}>
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-card border border-border rounded-2xl z-50 overflow-hidden"
          style={{ boxShadow: "0 24px 60px oklch(0 0 0 / 22%), 0 0 0 1px oklch(0 0 0 / 6%)" }}>

          <div className="px-4 py-3 border-b border-border flex justify-between items-center">
            <p className="text-[13px] font-semibold text-foreground">
              {isAdmin ? "Actividad del equipo" : "Notificaciones"}
            </p>
            {count > 0 && (
              <button onClick={markAll}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                Marcar todas leídas
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {count === 0 ? (
              <div className="py-8 text-center">
                <Bell size={20} className="text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-[13px] text-muted-foreground">Sin notificaciones nuevas</p>
              </div>
            ) : (
              items.map(n => (
                <a key={n.id} href={n.href}
                  onClick={() => markOne(n.id)}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0">
                  <div className="w-1.5 h-1.5 rounded-full mt-[6px] flex-shrink-0"
                    style={{ backgroundColor: "oklch(0.60 0.22 27)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-foreground leading-snug font-medium">{n.text}</p>
                    {n.sub && (
                      <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-1">{n.sub}</p>
                    )}
                    {n.date && (
                      <p className="text-[11px] text-muted-foreground mt-1 capitalize">
                        {format(n.date, "EEEE d 'de' MMMM · HH:mm", { locale: es })}
                      </p>
                    )}
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
