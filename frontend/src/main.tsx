import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import Login from './pages/Login'
import PlanCanvas from './pages/PlanCanvas'
import ProjectDetail from './pages/ProjectDetail'
import Projects from './pages/Projects'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:projectId" element={<ProjectDetail />} />
        <Route path="/projects/:projectId/canvas" element={<PlanCanvas />} />
        <Route path="/" element={<Navigate to="/projects" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
