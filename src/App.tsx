import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import CampusDesign from './pages/CampusDesign'
import CareerSim from './pages/CareerSim'
import ChatObserve from './pages/ChatObserve'
import Login from './pages/Login'
import Report from './pages/Report'
import ScoutChat from './pages/ScoutChat'
import StoryCreate from './pages/StoryCreate'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/chat-observe" element={<ChatObserve />} />
        <Route path="/story-create/*" element={<StoryCreate />} />
        <Route path="/campus-design" element={<CampusDesign />} />
        <Route path="/career-sim" element={<CareerSim />} />
        <Route path="/scout" element={<ScoutChat />} />
        <Route path="/report" element={<Report />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
