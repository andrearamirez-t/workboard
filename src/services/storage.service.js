import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage"
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp, query, orderBy } from "firebase/firestore"
import { storage, db } from "@/services/firebase"

export const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15 MB

// Sube un archivo y guarda su metadata en Firestore
export const uploadDocument = (colleagueId, file, { onProgress, uploadedBy, uploadedByName, proyectoNombre } = {}) => {
  return new Promise((resolve, reject) => {
    const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
    const safeProjName = proyectoNombre ? proyectoNombre.replace(/[^a-zA-Z0-9._-]/g, "_") : "_general"
    const storagePath = `documentos/${colleagueId}/${safeProjName}/${safeName}`
    const storageRef = ref(storage, storagePath)
    const task = uploadBytesResumable(storageRef, file)

    task.on(
      "state_changed",
      snap => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref)
          const docRef = await addDoc(collection(db, "companeros", colleagueId, "documentos"), {
            nombre: file.name,
            url,
            storagePath,
            size: file.size,
            tipo: file.type || "application/octet-stream",
            proyectoNombre: proyectoNombre || null,
            subidoPor: uploadedBy || null,
            subidoPorNombre: uploadedByName || null,
            createdAt: serverTimestamp(),
          })
          resolve({ id: docRef.id, nombre: file.name, url, size: file.size, tipo: file.type, storagePath })
        } catch (err) {
          reject(err)
        }
      }
    )
  })
}

export const getDocuments = async (colleagueId) => {
  const snap = await getDocs(
    query(collection(db, "companeros", colleagueId, "documentos"), orderBy("createdAt", "desc"))
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const deleteDocument = async (colleagueId, docId, storagePath) => {
  await deleteObject(ref(storage, storagePath))
  await deleteDoc(doc(db, "companeros", colleagueId, "documentos", docId))
}
