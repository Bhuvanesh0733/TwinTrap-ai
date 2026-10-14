import { Routes, Route, Navigate } from 'react-router-dom'
import { DeviceProvider } from './context/DeviceContext'
import AppShell from './components/layout/AppShell'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import DriftControls from './pages/DriftControls'
import DeviceConnect from './pages/DeviceConnect'
import MobileClient from './mobile/MobileClient'

export default function App() {
  return (
    <DeviceProvider>
      <Routes>
        {/* Phone-optimised standalone page */}
        <Route path="/mobile" element={<MobileClient />} />

        <Route element={<AppShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/drift" element={<DriftControls />} />
          <Route path="/connect" element={<DeviceConnect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </DeviceProvider>
  )
}
