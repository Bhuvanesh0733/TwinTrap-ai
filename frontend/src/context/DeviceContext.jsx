import { createContext, useContext, useState, useCallback } from 'react'

export const DEVICES = {
  mobile: {
    id: 'mobile',
    name: 'Smartphone',
    tagline: 'Real Hardware Device',
    description:
      'Use your phone as a live physical sensor. Connect via USB or WiFi — motion sensors stream in real time.',
    icon: '📱',
    available: true,
    availabilityLabel: 'Real hardware available',
    availabilityColor: '#16a34a',
    sensors: ['Accelerometer (X/Y/Z)', 'Gyroscope (α/β/γ)', 'Orientation'],
    accentColor: '#0d7d76',
    accentSoft: '#e3f3f1',
    mode: 'real',
  },
  industrial: {
    id: 'industrial',
    name: 'Industrial Machine',
    tagline: 'Simulation Mode',
    description:
      'Simulated industrial motor with 6 sensor channels. No hardware needed — perfect for demonstration.',
    icon: '🏭',
    available: false,
    availabilityLabel: 'Simulation available',
    availabilityColor: '#7c3aed',
    sensors: ['Temperature', 'Vibration', 'RPM', 'Current', 'Torque', 'Pressure'],
    accentColor: '#7c3aed',
    accentSoft: '#f3f0ff',
    mode: 'simulation',
  },
}

const DeviceContext = createContext(null)

export function DeviceProvider({ children }) {
  const [selectedDevice, setSelectedDevice] = useState(null) // 'mobile' | 'industrial'
  const [mobileDeviceId, setMobileDeviceId] = useState(null) // active phone session ID

  const selectDevice = useCallback((deviceId) => {
    setSelectedDevice(deviceId)
  }, [])

  const clearDevice = useCallback(() => {
    setSelectedDevice(null)
    setMobileDeviceId(null)
  }, [])

  const setActiveMobileDevice = useCallback((id) => {
    setMobileDeviceId(id)
  }, [])

  const value = {
    selectedDevice,
    mobileDeviceId,
    selectDevice,
    clearDevice,
    setActiveMobileDevice,
    deviceConfig: selectedDevice ? DEVICES[selectedDevice] : null,
  }

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>
}

export function useDevice() {
  const ctx = useContext(DeviceContext)
  if (!ctx) throw new Error('useDevice must be used inside DeviceProvider')
  return ctx
}
