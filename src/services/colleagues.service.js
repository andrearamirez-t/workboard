import { collection, getDocs, getDoc, updateDoc, deleteDoc, doc, arrayRemove, query, where } from "firebase/firestore"
import { db } from "@/services/firebase"

export const getColleagues = async () => {
  const snapshot = await getDocs(collection(db, "companeros"))
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const getColleagueByEmail = async (email) => {
  const q = query(collection(db, "companeros"), where("email", "==", email))
  const snap = await getDocs(q)
  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() }
}

export const linkColleagueUid = async (colleagueId, uid) => {
  return await updateDoc(doc(db, "companeros", colleagueId), { uid })
}

export const deleteColleague = async (id) => {
  return await deleteDoc(doc(db, "companeros", id))
}

export const deleteProject = async (colleagueId, proyecto) => {
  return await updateDoc(doc(db, "companeros", colleagueId), {
    proyectos: arrayRemove(proyecto)
  })
}

export const updateProject = async (colleagueId, oldProject, newProject) => {
  const docRef = doc(db, "companeros", colleagueId)
  const snap = await getDoc(docRef)
  const proyectos = snap.data().proyectos || []
  const updated = proyectos.map(p =>
    JSON.stringify(p) === JSON.stringify(oldProject) ? newProject : p
  )
  return await updateDoc(docRef, { proyectos: updated })
}
