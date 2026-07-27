// Vite resuelve ?url en build time e incluye el worker como asset estático
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url"
export { workerSrc }
