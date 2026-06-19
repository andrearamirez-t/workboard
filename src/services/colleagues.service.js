import { collection, getDocs, getDoc, updateDoc, deleteDoc, doc, arrayRemove } from "firebase/firestore"
import { db } from "@/services/firebase"

export const getColleagues = async () => {
  const snapshot = await getDocs(collection(db, "companeros"))
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
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
