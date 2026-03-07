import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Feed from './pages/Feed'
import NewPost from './pages/NewPost'
import Messages from './pages/Messages'
import Conversation from './pages/Conversation'
import Login from './pages/Login'
import UpdateBanner from './components/UpdateBanner'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-4xl animate-pulse font-bold text-brand-500">mmmh</div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" />
  return children
}

export default function App() {
  return (
    <>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Feed />} />
        <Route path="new" element={<NewPost />} />
        <Route path="messages" element={<Messages />} />
        <Route path="chat/:id" element={<Conversation />} />
      </Route>
    </Routes>
    {/* PWA update banner — sits above nav, shown globally */}
    <UpdateBanner />
    </>
  )
}
