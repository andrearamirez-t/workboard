import { collection, addDoc, getDocs, deleteDoc, updateDoc, doc, serverTimestamp, orderBy, query } from "firebase/firestore"
import { db } from "@/services/firebase"

export const addFeedback = async (colleagueId, texto, author) => {
  return await addDoc(collection(db, "companeros", colleagueId, "retroalimentacion"), {
    texto,
    creadoPorEmail: author.email,
    creadoPorNombre: author.displayName || author.email,
    createdAt: serverTimestamp(),
  })
}

export const getFeedback = async (colleagueId) => {
  const q = query(
    collection(db, "companeros", colleagueId, "retroalimentacion"),
    orderBy("createdAt", "desc")
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const deleteFeedback = async (colleagueId, feedbackId) => {
  return await deleteDoc(doc(db, "companeros", colleagueId, "retroalimentacion", feedbackId))
}

export const updateFeedback = async (colleagueId, feedbackId, texto) => {
  return await updateDoc(doc(db, "companeros", colleagueId, "retroalimentacion", feedbackId), { texto })
}
