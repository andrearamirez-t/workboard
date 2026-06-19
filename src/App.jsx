import { Routes, Route, Navigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import Login from "@/pages/Login"
import Dashboard from "@/pages/Dashboard"
import ColleagueForm from "@/pages/ColleagueForm"
import ColleagueDetail from "@/pages/ColleagueDetail"
import ProjectForm from "@/pages/ProjectForm"
import Bitacora from "@/pages/Bitacora"
import NotFound from "@/pages/NotFound"

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-8 text-gray-400">Cargando...</div>
  return user ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/colleague/new" element={<ProtectedRoute><ColleagueForm /></ProtectedRoute>} />
      <Route path="/colleague/:id" element={<ProtectedRoute><ColleagueDetail /></ProtectedRoute>} />
      <Route path="/colleague/:id/edit" element={<ProtectedRoute><ColleagueForm /></ProtectedRoute>} />
      <Route path="/colleague/:id/project/new" element={<ProtectedRoute><ProjectForm /></ProtectedRoute>} />
      <Route path="/bitacora" element={<ProtectedRoute><Bitacora /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
