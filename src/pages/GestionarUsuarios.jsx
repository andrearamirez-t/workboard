import { useEffect, useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { collection, getDocs, deleteDoc, doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore"
import { db } from "@/services/firebase"
import { getAllUsuarios, setUsuarioRole } from "@/services/usuarios.service"
import { getColleaguesBySemillero } from "@/services/colleagues.service"
import { SUPER_ADMIN_EMAILS } from "@/context/AuthContext"
import { useAuth } from "@/context/AuthContext"

const ROLE_LABELS  = { superadmin: "Super Admin", admin: "Coordinador", member: "Miembro" }
const ROLE_COLORS  = {
  superadmin: { bg: "oklch(0.58 0.16 295 / 0.12)", color: "oklch(0.46 0.18 295)" },
  admin:      { bg: "oklch(0.52 0.13 165 / 0.12)", color: "oklch(0.40 0.13 165)" },
  member:     { bg: "oklch(0.60 0.12 230 / 0.10)", color: "oklch(0.48 0.12 230)" },
}

export default function GestionarUsuarios({ semilleros = [] }) {
  const navigate = useNavigate()
  const { user, isSuperAdmin, mySemilleroId } = useAuth()
  const [users,         setUsers]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(null)
  const [editingKey,    setEditingKey]    = useState(null)
  const [editForm,      setEditForm]      = useState({ role: "member", semilleroId: "", email: "" })
  const [search,        setSearch]        = useState("")
  const [selected,      setSelected]      = useState(new Set())
  const [confirmDelete, setConfirmDelete] = useState(null) // key | "bulk"
  const [confirmSave,   setConfirmSave]   = useState(null) // { u, form } pendiente de confirmar
  const [bulkRole,      setBulkRole]      = useState("")
  const [deleting,      setDeleting]      = useState(false)
  const [groupView,     setGroupView]     = useState(true)

  /* ── Carga y deduplicación ───────────────────────────────────────── */
  useEffect(() => {
    if (semilleros.length === 0) return   // esperar a que GlobalDashboard cargue los semilleros
    const load = async () => {
      try {
        // 1. Roles desde usuarios collection
        const usuariosDocs = await getAllUsuarios().catch(() => [])

        // 2. Companeros por semillero (semilleroId garantizado por la query)
        const perSemillero = await Promise.all(
          semilleros.map(s =>
            getColleaguesBySemillero(s.id)
              .then(cols => cols.map(c => ({ ...c, _cid: c.id, semilleroId: s.id })))
              .catch(() => [])
          )
        )
        const conEquipo = perSemillero.flat()
        const asignados = new Set(conEquipo.map(c => c._cid))

        // 3. Companeros sin semillero (huérfanos — campo null o doc sin campo)
        const todoSnap = await getDocs(collection(db, "companeros"))
        const sinEquipo = todoSnap.docs
          .filter(d => !asignados.has(d.id))
          .map(d => ({ _cid: d.id, semilleroId: null, ...d.data() }))

        const allCompaneros = [...conEquipo, ...sinEquipo]

        // 4. Merge deduplicado por email
        // Mapa uid → doc para poder releer el role correcto en el segundo pase
        const uidToUsuario = {}
        usuariosDocs.forEach(u => { uidToUsuario[u.id] = u })

        const byEmail = {}

        // Primero roles desde usuarios. Si hay dos docs con el mismo email, gana el de mayor rango.
        const roleRank = r => r === "admin" ? 2 : r === "superadmin" ? 3 : 1
        usuariosDocs.forEach(u => {
          const email = u.email?.toLowerCase()
          if (!email) return
          const isSA = SUPER_ADMIN_EMAILS.includes(email)
          const prev = byEmail[email]
          if (!prev || roleRank(u.role) > roleRank(prev.role)) {
            byEmail[email] = { ...u, _key: u.id, _sinLogin: false, _isSuperAdmin: isSA, role: isSA ? "superadmin" : (u.role || "member") }
          }
        })

        // Luego companeros — semilleroId de aquí es AUTORIDAD (viene de la query por equipo)
        // También indexar por uid para compañeros sin email registrado
        const byUid = {}
        allCompaneros.forEach(c => {
          const email = (c.email || c.correo || "").toLowerCase()
          const isSA = email && SUPER_ADMIN_EMAILS.includes(email)

          // Compañero sin email: usar uid como clave si tiene, o cid como último recurso
          if (!email) {
            const key = c.uid ? `uid_${c.uid}` : `cid_${c._cid}`
            if (!byUid[key]) {
              byUid[key] = {
                _key:        c.uid || `cid_${c._cid}`,
                id:          c.uid || `cid_${c._cid}`,
                _cid:        c._cid,
                email:       c.uid && uidToUsuario[c.uid]?.email ? uidToUsuario[c.uid].email.toLowerCase() : "",
                nombre:      c.nombre || "",
                role:        c.uid && uidToUsuario[c.uid] ? (uidToUsuario[c.uid].role || "member") : "member",
                semilleroId: c.semilleroId,
                _sinLogin:   !c.uid,
                _isSuperAdmin: false,
              }
            }
            return
          }

          if (!byEmail[email]) {
            byEmail[email] = {
              _key:        c.uid || `cid_${c._cid}`,
              id:          c.uid || `cid_${c._cid}`,
              _cid:        c._cid,
              email,
              nombre:      c.nombre || "",
              role:        isSA ? "superadmin" : (c.uid && uidToUsuario[c.uid] ? (uidToUsuario[c.uid].role || "member") : (c.rolAsignado || "member")),
              semilleroId: c.semilleroId,
              _sinLogin:   !c.uid,
              _isSuperAdmin: isSA,
            }
          } else {
            if (!byEmail[email]._cid)   byEmail[email]._cid   = c._cid
            if (!byEmail[email].nombre) byEmail[email].nombre = c.nombre || ""
            if (isSA) byEmail[email]._isSuperAdmin = true
            // Preferir siempre un semilleroId concreto sobre null
            if (c.semilleroId && !byEmail[email].semilleroId)
              byEmail[email].semilleroId = c.semilleroId
            if (c.uid) {
              byEmail[email].id        = c.uid
              byEmail[email]._key      = c.uid
              byEmail[email]._sinLogin = false
              if (isSA) {
                byEmail[email].role = "superadmin"
              } else if (uidToUsuario[c.uid]) {
                byEmail[email].role = uidToUsuario[c.uid].role || "member"
              }
            } else if (!isSA && c.rolAsignado) {
              // Sin login: usar rol anticipado guardado en el companion
              byEmail[email].role = c.rolAsignado
            }
          }
        })

        // Fusionar compañeros sin email; evitar duplicados por _cid o uid ya presentes
        const knownCids = new Set(Object.values(byEmail).filter(e => e._cid).map(e => e._cid))
        const knownUids = new Set(Object.values(byEmail).filter(e => e.id && !e.id.startsWith("cid_")).map(e => e.id))
        Object.values(byUid).forEach(u => {
          if (u.email && byEmail[u.email]) {
            if (!byEmail[u.email]._cid) byEmail[u.email]._cid = u._cid
          } else if (!knownCids.has(u._cid) && !(u.id && knownUids.has(u.id))) {
            byEmail[u._key] = u
          }
        })

        const list = Object.values(byEmail)
          .sort((a, b) => (a.nombre || a.email || "").localeCompare(b.nombre || b.email || ""))
        setUsers(list)
      } catch (e) {
        console.error("Error cargando usuarios:", e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [semilleros])

  /* ── Filtro y agrupación ─────────────────────────────────────────── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return users.filter(u => {
      // Admin (no superadmin) solo ve su propio equipo; tras transferir, el usuario desaparece
      if (!isSuperAdmin && u.semilleroId !== mySemilleroId) return false
      if (!q) return true
      const semNombre = semilleros.find(s => s.id === u.semilleroId)?.nombre?.toLowerCase() || ""
      return u.nombre?.toLowerCase().includes(q) ||
             u.email?.toLowerCase().includes(q) ||
             semNombre.includes(q)
    })
  }, [users, search, semilleros, isSuperAdmin, mySemilleroId])

  const groups = useMemo(() => {
    if (!groupView) return [{ id: "__all", nombre: "Todos", members: filtered }]
    const map = {}
    filtered.forEach(u => {
      const sid = u.semilleroId || "__sin"
      if (!map[sid]) {
        const sem = semilleros.find(s => s.id === sid)
        const coordUid = sem?.coordinadores?.[0]
        const coordUser = (coordUid ? users.find(u => u.id === coordUid) : null)
          || filtered.find(u => u.semilleroId === sid && u.role === "admin")
        const coordName = coordUser?.nombre || coordUser?.email?.split("@")[0] || null
        map[sid] = { id: sid, nombre: sem?.nombre || "Sin equipo", coordName, members: [] }
      }
      map[sid].members.push(u)
    })
    // Orden: equipos conocidos primero, "Sin equipo" al final
    return [
      ...semilleros.filter(s => map[s.id]).map(s => map[s.id]),
      ...(map["__sin"] ? [map["__sin"]] : []),
    ]
  }, [filtered, groupView, semilleros, users])

  /* ── Selección ───────────────────────────────────────────────────── */
  const toggleSelect = (key) => setSelected(prev => {
    const n = new Set(prev)
    n.has(key) ? n.delete(key) : n.add(key)
    return n
  })
  const toggleGroup = (members) => {
    const keys = members.filter(u => !u._sinLogin).map(u => u._key)
    const allSelected = keys.every(k => selected.has(k))
    setSelected(prev => {
      const n = new Set(prev)
      keys.forEach(k => allSelected ? n.delete(k) : n.add(k))
      return n
    })
  }
  const clearSelection = () => setSelected(new Set())

  /* ── Guardar rol ─────────────────────────────────────────────────── */
  const handleSave = async (u, form) => {
    // form se pasa explícito desde el modal para evitar leer estado React obsoleto
    const f = form || editForm
    setSaving(u._key)
    try {
      const newSemilleroId = f.semilleroId || null

      const companeroUpdate = {}
      const newEmail = (f.email || "").trim().toLowerCase()
      const emailChanged = u._sinLogin && newEmail && newEmail !== u.email
      if (emailChanged) companeroUpdate.email = newEmail
      if (newSemilleroId !== (u.semilleroId || null)) companeroUpdate.semilleroId = newSemilleroId
      // Para sin-login: guardar rol anticipado en companion para que se aplique en su primer login
      if (u._sinLogin) companeroUpdate.rolAsignado = f.role
      if (u._cid && Object.keys(companeroUpdate).length > 0) {
        await updateDoc(doc(db, "companeros", u._cid), companeroUpdate)
      }

      // 2. Actualizar rol (usuarios con UID)
      if (!u._sinLogin && !u.id.startsWith("cid_")) {
        await setUsuarioRole(u.id, f.role, newSemilleroId)

        // 3. Sincronizar campo coordinadores del semillero
        const semRef     = newSemilleroId                              ? doc(db, "semilleros", newSemilleroId)  : null
        const prevSemRef = u.semilleroId && u.semilleroId !== newSemilleroId ? doc(db, "semilleros", u.semilleroId) : null
        if (f.role === "admin" && semRef) {
          await updateDoc(semRef, { coordinadores: arrayUnion(u.id) }).catch(() => {})
        }
        if (u.role === "admin") {
          if (prevSemRef) {
            await updateDoc(prevSemRef, { coordinadores: arrayRemove(u.id) }).catch(() => {})
          } else if (f.role !== "admin" && semRef) {
            await updateDoc(semRef, { coordinadores: arrayRemove(u.id) }).catch(() => {})
          }
        }
      }

      setUsers(prev => prev.map(x =>
        x._key === u._key ? {
          ...x,
          role: f.role,
          semilleroId: newSemilleroId,
          email: emailChanged ? newEmail : x.email,
        } : x
      ))
      setEditingKey(null)
    } catch (e) {
      console.error("Error guardando cambios:", e)
      alert(`No se pudo guardar: ${e?.message || "error desconocido"}`)
    }
    finally { setSaving(null) }
  }

  /* ── Eliminar ────────────────────────────────────────────────────── */
  const doDelete = async (keys) => {
    setDeleting(true)
    try {
      const targets = users.filter(u => keys.includes(u._key))
      await Promise.all(targets.flatMap(u => {
        const ops = []
        if (u._cid) ops.push(deleteDoc(doc(db, "companeros", u._cid)))
        if (u.id && !u.id.startsWith("cid_")) ops.push(deleteDoc(doc(db, "usuarios", u.id)))
        return ops
      }))
      setUsers(prev => prev.filter(u => !keys.includes(u._key)))
      setSelected(prev => { const n = new Set(prev); keys.forEach(k => n.delete(k)); return n })
    } catch (e) { console.error(e) }
    finally { setDeleting(false); setConfirmDelete(null) }
  }

  /* ── Cambio de rol masivo ────────────────────────────────────────── */
  const handleBulkRole = async () => {
    if (!bulkRole) return
    setSaving("bulk")
    const targets = users.filter(u => selected.has(u._key) && !u._sinLogin)
    try {
      await Promise.all(targets.map(u => setUsuarioRole(u.id, bulkRole, u.semilleroId || null)))
      setUsers(prev => prev.map(u =>
        selected.has(u._key) && !u._sinLogin ? { ...u, role: bulkRole } : u
      ))
      clearSelection()
      setBulkRole("")
    } catch (e) { console.error(e) }
    finally { setSaving(null) }
  }

  /* ── Render ──────────────────────────────────────────────────────── */
  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-[13px] text-muted-foreground">Cargando usuarios…</p>
    </div>
  )

  const selectedList = [...selected]
  const hasSelection = selectedList.length > 0

  return (
    <div className="flex flex-col gap-4 h-full w-full">

      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-[20px] font-bold text-foreground tracking-tight">Gestionar usuarios</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">Asigna roles y equipos a los integrantes.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setGroupView(v => !v)}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
            style={{ color: "var(--muted-foreground)" }}>
            {groupView ? "Vista plana" : "Por equipo"}
          </button>
          <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: "oklch(0.52 0.13 165 / 0.10)", color: "oklch(0.40 0.13 165)" }}>
            {users.length} usuarios
          </span>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative flex-shrink-0">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input type="text" placeholder="Buscar por nombre o correo…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-4 py-2 rounded-xl border border-border bg-card text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none" />
      </div>

      {/* Lista con scroll */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden flex-1"
        style={{ maxHeight: "calc(100vh - 280px)", overflowY: "auto" }}>
        {groups.every(g => g.members.length === 0) ? (
          <div className="py-12 text-center">
            <p className="text-[13px] text-muted-foreground">{search ? "Sin resultados." : "No hay usuarios."}</p>
          </div>
        ) : groups.map((group, gi) => {
          if (group.members.length === 0) return null
          const groupKeys = group.members.filter(u => !u._sinLogin).map(u => u._key)
          const groupAllSelected = groupKeys.length > 0 && groupKeys.every(k => selected.has(k))

          return (
            <div key={group.id}>
              {/* Cabecera de grupo */}
              {groupView && (
                <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border/60 sticky top-0 z-10"
                  style={{ background: "var(--muted)" }}>
                  {groupKeys.length > 0 && (
                    <input type="checkbox" checked={groupAllSelected}
                      onChange={() => toggleGroup(group.members)}
                      className="w-3.5 h-3.5 rounded accent-teal-500 cursor-pointer" />
                  )}
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    {group.nombre}
                  </span>
                  {group.coordName && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "oklch(0.52 0.13 165 / 0.10)", color: "oklch(0.40 0.13 165)" }}>
                      Coordinador: {group.coordName}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground/60">{group.members.length} personas</span>
                </div>
              )}

              {/* Filas */}
              <div className={gi < groups.length - 1 ? "border-b border-border/40" : ""}>
                {group.members.map(u => {
                  const isEditing  = editingKey === u._key
                  const isSelected = selected.has(u._key)
                  const roleStyle  = ROLE_COLORS[u.role] || ROLE_COLORS.member
                  const canEdit    = !u._sinLogin

                  return (
                    <div key={u._key}
                      className={`px-5 py-3 border-b border-border/40 last:border-0 transition-colors ${isSelected ? "bg-muted/40" : "hover:bg-muted/20"}`}>
                      <div className="flex items-center gap-3">
                        {/* Checkbox */}
                        {canEdit
                          ? <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(u._key)}
                              className="w-3.5 h-3.5 rounded cursor-pointer flex-shrink-0" />
                          : <div className="w-3.5 flex-shrink-0" />
                        }

                        {/* Avatar + Info — clickeable si tiene perfil */}
                        <div
                          className={`flex items-center gap-2.5 flex-1 min-w-0${u._cid && u.semilleroId ? " cursor-pointer group" : ""}`}
                          onClick={() => u._cid && u.semilleroId && navigate(`/semillero/${u.semilleroId}/colleague/${u._cid}`)}>
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0"
                          style={{ background: "linear-gradient(135deg, oklch(0.62 0.18 165), oklch(0.54 0.22 205))" }}>
                          {u.nombre?.charAt(0)?.toUpperCase() || u.email?.charAt(0)?.toUpperCase() || "?"}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[12.5px] font-semibold text-foreground truncate group-hover:underline">{u.nombre || u.email}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: roleStyle.bg, color: roleStyle.color }}>
                              {ROLE_LABELS[u.role] || "Miembro"}
                            </span>
                            {u._sinLogin && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: "oklch(0.65 0.12 60 / 0.12)", color: "oklch(0.52 0.14 60)" }}>
                                Sin login
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                        </div>
                        </div>{/* /clickeable wrapper */}

                        {/* Acciones */}
                        {!isEditing && !hasSelection && (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {u._isSuperAdmin && u.email === user?.email?.toLowerCase() ? null : (<>
                            <button onClick={() => { setEditingKey(u._key); setEditForm({ role: u.role || "member", semilleroId: u.semilleroId || "", email: u.email || "" }) }}
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-border hover:bg-muted transition-colors"
                              style={{ color: "var(--foreground)" }}>
                              Editar
                            </button>
                            <button onClick={() => setConfirmDelete(u._key)}
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-destructive/30 hover:bg-destructive/10 transition-colors"
                              style={{ color: "var(--destructive)" }}>
                              Eliminar
                            </button>
                            </>)}
                          </div>
                        )}
                        {!isEditing && hasSelection && !canEdit && (
                          <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">Pendiente login</span>
                        )}
                      </div>

                      {/* Editor inline */}
                      {isEditing && (
                        <div className="mt-3 ml-10 flex flex-wrap items-end gap-3">
                          {u._sinLogin && (
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                Correo de Google
                              </label>
                              <input type="email" value={editForm.email}
                                onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                                placeholder="correo@cun.edu.co"
                                className="h-8 w-52 rounded-lg border border-border bg-background text-[12px] text-foreground px-2 focus:outline-none" />
                              <p className="text-[9px] text-muted-foreground/60">Corrige si no coincide con su cuenta Google</p>
                            </div>
                          )}
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Rol</label>
                            <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                              className="h-8 rounded-lg border border-border bg-background text-[12px] text-foreground px-2 focus:outline-none">
                              <option value="member">Miembro</option>
                              <option value="admin">Coordinador</option>
                              <option value="superadmin">Super Admin</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Equipo</label>
                            <select value={editForm.semilleroId} onChange={e => setEditForm(f => ({ ...f, semilleroId: e.target.value }))}
                              className="h-8 rounded-lg border border-border bg-background text-[12px] text-foreground px-2 focus:outline-none">
                              <option value="">— Sin equipo —</option>
                              {semilleros.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => setConfirmSave({ u, form: editForm })}
                              disabled={saving === u._key}
                              className="h-8 px-3 rounded-lg text-[12px] font-semibold text-white disabled:opacity-50"
                              style={{ background: "oklch(0.52 0.13 165)" }}>
                              Guardar
                            </button>
                            <button onClick={() => setEditingKey(null)}
                              className="h-8 px-3 rounded-lg text-[12px] font-medium border border-border hover:bg-muted transition-colors"
                              style={{ color: "var(--foreground)" }}>
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Barra flotante de selección múltiple */}
      {hasSelection && (
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-2xl border border-border shadow-lg"
          style={{ background: "var(--card)" }}>
          <span className="text-[12px] font-semibold text-foreground">
            {selectedList.length} seleccionado{selectedList.length !== 1 ? "s" : ""}
          </span>
          <div className="flex-1 flex items-center gap-2">
            <select value={bulkRole} onChange={e => setBulkRole(e.target.value)}
              className="h-8 rounded-lg border border-border bg-background text-[12px] text-foreground px-2 focus:outline-none">
              <option value="">Cambiar rol a…</option>
              <option value="member">Miembro</option>
              <option value="admin">Coordinador</option>
            </select>
            {bulkRole && (
              <button onClick={handleBulkRole} disabled={saving === "bulk"}
                className="h-8 px-3 rounded-lg text-[12px] font-semibold text-white disabled:opacity-50"
                style={{ background: "oklch(0.52 0.13 165)" }}>
                {saving === "bulk" ? "Aplicando…" : "Aplicar"}
              </button>
            )}
          </div>
          <button onClick={() => setConfirmDelete("bulk")}
            className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-destructive/30 hover:bg-destructive/10 transition-colors"
            style={{ color: "var(--destructive)" }}>
            Eliminar {selectedList.length}
          </button>
          <button onClick={clearSelection}
            className="h-8 px-2 rounded-lg text-[12px] text-muted-foreground hover:bg-muted transition-colors">
            ✕
          </button>
        </div>
      )}

      {/* Modal de confirmación de guardado */}
      {confirmSave && (() => {
        const { u, form } = confirmSave
        const semNombreOld = semilleros.find(s => s.id === u.semilleroId)?.nombre || "Sin equipo"
        const semNombreNew = semilleros.find(s => s.id === form.semilleroId)?.nombre || "Sin equipo"
        const roleChange  = form.role !== (u.role || "member")
        const teamChange  = form.semilleroId !== (u.semilleroId || "")
        const emailChange = u._sinLogin && form.email.trim().toLowerCase() !== (u.email || "")
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "oklch(0 0 0 / 50%)", backdropFilter: "blur(4px)" }}
            onClick={() => setConfirmSave(null)}>
            <div className="bg-card border border-border rounded-2xl p-6 w-[380px] space-y-4 shadow-xl"
              onClick={e => e.stopPropagation()}>
              <h3 className="text-[15px] font-bold text-foreground">Confirmar cambios</h3>
              <p className="text-[13px] text-muted-foreground">
                Se aplicarán los siguientes cambios a <span className="font-semibold text-foreground">{u.nombre || u.email}</span>:
              </p>
              <ul className="space-y-2 text-[13px]">
                {teamChange && (
                  <li className="flex items-center gap-2">
                    <span className="text-muted-foreground">Equipo:</span>
                    <span className="line-through text-muted-foreground/60">{semNombreOld}</span>
                    <span>→</span>
                    <span className="font-semibold text-foreground">{semNombreNew}</span>
                  </li>
                )}
                {roleChange && (
                  <li className="flex items-center gap-2">
                    <span className="text-muted-foreground">Rol:</span>
                    <span className="line-through text-muted-foreground/60">{ROLE_LABELS[u.role] || "Miembro"}</span>
                    <span>→</span>
                    <span className="font-semibold text-foreground">{ROLE_LABELS[form.role]}</span>
                  </li>
                )}
                {emailChange && (
                  <li className="flex items-center gap-2 flex-wrap">
                    <span className="text-muted-foreground">Correo:</span>
                    <span className="line-through text-muted-foreground/60">{u.email}</span>
                    <span>→</span>
                    <span className="font-semibold text-foreground">{form.email.trim().toLowerCase()}</span>
                  </li>
                )}
                {!teamChange && !roleChange && !emailChange && (
                  <li className="text-muted-foreground italic">Sin cambios detectados.</li>
                )}
              </ul>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setConfirmSave(null)}
                  className="h-9 px-4 rounded-xl text-[13px] font-medium border border-border hover:bg-muted transition-colors"
                  style={{ color: "var(--foreground)" }}>
                  Cancelar
                </button>
                <button
                  onClick={() => { handleSave(u, form); setConfirmSave(null) }}
                  disabled={saving === u._key}
                  className="h-9 px-4 rounded-xl text-[13px] font-semibold text-white disabled:opacity-50"
                  style={{ background: "oklch(0.52 0.13 165)" }}>
                  {saving === u._key ? "Guardando…" : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal de confirmación de borrado */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "oklch(0 0 0 / 50%)", backdropFilter: "blur(4px)" }}
          onClick={() => setConfirmDelete(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-[340px] space-y-4 shadow-xl"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold text-foreground">
              {confirmDelete === "bulk"
                ? `Eliminar ${selectedList.length} usuario${selectedList.length !== 1 ? "s" : ""}`
                : "Eliminar usuario"}
            </h3>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Esta acción eliminará el perfil y todos sus datos de la plataforma. No se puede deshacer.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)}
                className="h-9 px-4 rounded-xl text-[13px] font-medium border border-border hover:bg-muted transition-colors"
                style={{ color: "var(--foreground)" }}>
                Cancelar
              </button>
              <button
                onClick={() => doDelete(confirmDelete === "bulk" ? selectedList : [confirmDelete])}
                disabled={deleting}
                className="h-9 px-4 rounded-xl text-[13px] font-semibold text-white disabled:opacity-50 transition-opacity"
                style={{ background: "var(--destructive)" }}>
                {deleting ? "Eliminando…" : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground/50 text-center flex-shrink-0">
        "Sin login" = aún no han ingresado por primera vez.
      </p>
    </div>
  )
}
