import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { StoryProvider } from './contexts/StoryContext'
import Background from './components/Layout/Background'
import Header from './components/Layout/Header'
import MusicPlayer from './components/Layout/MusicPlayer'
import Loading from './components/Shared/Loading'
import ChannelPage from './pages/ChannelPage'
import CharacterPage from './pages/CharacterPage'
import GalleryPage from './pages/GalleryPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import StoryPlayPage from './pages/StoryPlayPage'
import TalentPage from './pages/TalentPage'

const STORY_ROOT = '/story-create'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading text="加载中..." />
  if (!user) return <Navigate to={`${STORY_ROOT}/login`} replace />
  return <>{children}</>
}

function ChannelGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading text="加载中..." />
  if (!user) return <Navigate to={`${STORY_ROOT}/login`} replace />
  if (!user.age_group) return <Navigate to={`${STORY_ROOT}/channel`} replace />
  return <>{children}</>
}

function StoryRoutes() {
  const { user, loading } = useAuth()

  if (loading) return <Loading text="正在启动故事世界..." />

  return (
    <Routes>
      <Route
        path="login"
        element={user ? <Navigate to={STORY_ROOT} replace /> : <LoginPage />}
      />
      <Route
        path="channel"
        element={
          <ProtectedRoute>
            <ChannelPage />
          </ProtectedRoute>
        }
      />
      <Route
        index
        element={
          <ProtectedRoute>
            <ChannelGuard>
              <HomePage />
            </ChannelGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="characters"
        element={
          <ProtectedRoute>
            <CharacterPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="play/:storyId"
        element={
          <ProtectedRoute>
            <StoryProvider>
              <StoryPlayPage />
            </StoryProvider>
          </ProtectedRoute>
        }
      />
      <Route
        path="gallery"
        element={
          <ProtectedRoute>
            <GalleryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="talent/:storyId"
        element={
          <ProtectedRoute>
            <TalentPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={STORY_ROOT} replace />} />
    </Routes>
  )
}

export default function StoryCreateApp() {
  return (
    <AuthProvider>
      <Background />
      <Header />
      <MusicPlayer />
      <StoryRoutes />
    </AuthProvider>
  )
}
