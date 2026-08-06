import { Routes, Route, Navigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import Login from "@/pages/Login"
import Dashboard from "@/pages/Dashboard"
import ColleagueForm from "@/pages/ColleagueForm"
import ColleagueDetail from "@/pages/ColleagueDetail"
import ProjectForm from "@/pages/ProjectForm"
import Bitacora from "@/pages/Bitacora"
import GroupDetail from "@/pages/GroupDetail"
import SemilleroSelector from "@/pages/SemilleroSelector"
import GlobalDashboard from "@/pages/GlobalDashboard"
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

      {/* Hub: semillero selector */}
      <Route path="/semilleros" element={<ProtectedRoute><SemilleroSelector /></ProtectedRoute>} />
      <Route path="/overview" element={<ProtectedRoute><GlobalDashboard /></ProtectedRoute>} />

      {/* Semillero-scoped workspace */}
      <Route path="/semillero/:semilleroId/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/semillero/:semilleroId/colleague/new" element={<ProtectedRoute><ColleagueForm /></ProtectedRoute>} />
      <Route path="/semillero/:semilleroId/colleague/:id" element={<ProtectedRoute><ColleagueDetail /></ProtectedRoute>} />
      <Route path="/semillero/:semilleroId/colleague/:id/edit" element={<ProtectedRoute><ColleagueForm /></ProtectedRoute>} />
      <Route path="/semillero/:semilleroId/colleague/:id/project/new" element={<ProtectedRoute><ProjectForm /></ProtectedRoute>} />
      <Route path="/semillero/:semilleroId/grupo/:id" element={<ProtectedRoute><GroupDetail /></ProtectedRoute>} />

      {/* Legacy redirects */}
      <Route path="/dashboard" element={<Navigate to="/semilleros" replace />} />

      <Route path="/bitacora" element={<ProtectedRoute><Bitacora /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
