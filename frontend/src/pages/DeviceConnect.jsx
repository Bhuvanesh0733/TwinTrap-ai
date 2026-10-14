import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { Card, CardHeader, Button } from '../components/ui/Primitives'
import { SeverityBadge } from '../components/ui/SeverityBadge'
import Twin3DScene from '../components/three/Twin3DScene'
import { useDevice } from '../context/DeviceContext'

// Resolve the mobile URL from the current page origin
const MOBILE_URL = `${window.location.protocol}//${window.location.hostname}:${
  window.location.port ||
  (window.location.protocol === 'https:' ? '443' : '80')
}/mobile`

const MOBILE_DRIFT_TYPES = ['gradual', 'sudden', 'gyro_scale', 'accel_bias', 'noise']


export default function DeviceConnect() {
  const { setActiveMobileDevice, selectDevice } = useDevice()
  const navigate = useNavigate()
  const [devices, setDevices] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [devState, setDevState] = useState(null)
  const [busy, setBusy] = useState(false)
  const [calibStatus, setCalibStatus] = useState(null) // null | 'calibrating' | 'done'
  const [driftType, setDriftType] = useState('gradual')
  const [driftSeverity, setDriftSeverity] = useState(0.7)
  const [copied, setCopied] = useState(false)

  // When a device connects, register it in the global device context
  useEffect(() => {
    if (activeId) {
      selectDevice('mobile')
      setActiveMobileDevice(activeId)
    }
  }, [activeId, selectDevice, setActiveMobileDevice])


  /* ── Poll device list ── */
  useEffect(() => {
    let alive = true
    const poll = async () => {
      try {
        const r = await api.mobileDevices()
        if (!alive) return
        setDevices(r.devices || [])
        if (!activeId && r.active_device_id) setActiveId(r.active_device_id)
      } catch { /* ignore */ }
    }
    poll()
    const id = setInterval(poll, 2000)
    return () => { alive = false; clearInterval(id) }
  }, [activeId])

  /* ── Poll active device state ── */
  useEffect(() => {
    if (!activeId) return
    let alive = true
    const poll = async () => {
      try {
        const s = await api.mobileState(activeId)
        if (alive) setDevState(s)
      } catch { /* ignore */ }
    }
    poll()
    const id = setInterval(poll, 1000)
    return () => { alive = false; clearInterval(id) }
  }, [activeId])

  const calibrate = async () => {
    if (!activeId) return
    setBusy(true)
    setCalibStatus('calibrating')
    try {
      await api.mobileCalibrate(activeId, 6)
      // Poll calibration status
      const check = setInterval(async () => {
        try {
          const s = await api.mobileCalibrateStatus(activeId)
          if (s.calibrated) { setCalibStatus('done'); clearInterval(check) }
        } catch { clearInterval(check) }
      }, 800)
      setTimeout(() => { clearInterval(check); setCalibStatus('done') }, 9000)
    } finally {
      setTimeout(() => setBusy(false), 6500)
    }
  }

  const injectDrift = () => {
    if (!activeId) return
    api.mobileDrift({ device_id: activeId, drift_type: driftType, severity: driftSeverity })
  }

  const clearDrift = () => {
    if (!activeId) return
    api.mobileClearDrift(activeId)
  }

  const resetDevice = () => {
    if (!activeId) return
    api.mobileReset(activeId).then(() => {
      setDevState(null)
      setActiveId(null)
      setCalibStatus(null)
    })
  }

  const copyUrl = () => {
    navigator.clipboard.writeText(MOBILE_URL).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const connectedDevices = devices.filter((d) => d.connected)
  const isDeviceConnected = devState?.connected === true

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div>
        <h1 className="font-mono text-xl font-bold text-[var(--color-ink)]">Device Connect</h1>
        <p className="mt-1 max-w-xl text-sm text-[var(--color-ink-dim)]">
          Open the device URL on your phone to stream live sensor data into the digital twin.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* ── Connection URL ── */}
        <Card>
          <CardHeader title="Device URL" subtitle="Open this address on your phone's browser" />
          <div className="space-y-4 p-5">
            {/* URL box */}
            <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3">
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-faint)]">
                  Mobile URL
                </div>
                <div className="truncate font-mono text-sm text-[var(--color-signal)]">
                  {MOBILE_URL}
                </div>
              </div>
              <button
                onClick={copyUrl}
                className="shrink-0 rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--color-ink-dim)] transition-colors hover:border-[var(--color-signal)] hover:text-[var(--color-signal)]"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            {/* Quick steps — no method-specific details */}
            <div className="divide-y divide-[var(--color-border-soft)] rounded-xl border border-[var(--color-border)] bg-white">
              {[
                ['Open the URL', 'Use Chrome on Android for best motion sensor support.'],
                ['Enable sensors', 'Tap "Enable Motion Sensors" then "Start Telemetry".'],
                ['Calibrate', 'Hold the phone still for 6 seconds when prompted.'],
              ].map(([title, desc], i) => (
                <div key={i} className="flex gap-3.5 px-4 py-3.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-signal-soft)] text-[10px] font-bold text-[var(--color-signal)]">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-[var(--color-ink)]">{title}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* ── Device List ── */}
        <Card>
          <CardHeader
            title="Connected Devices"
            subtitle={
              connectedDevices.length > 0
                ? `${connectedDevices.length} device${connectedDevices.length !== 1 ? 's' : ''} streaming live`
                : 'No devices connected yet'
            }
          />
          <div className="p-5">
            {devices.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-border)] py-12 text-center">
                <div className="mb-1 h-8 w-8 rounded-full border-2 border-dashed border-[var(--color-border)]" />
                <p className="text-sm font-medium text-[var(--color-ink-dim)]">Waiting for a device</p>
                <p className="text-xs text-[var(--color-ink-faint)]">Open the URL above on your phone</p>
              </div>
            ) : (

              <div className="space-y-2">
                {devices.map((d) => (
                  <button
                    key={d.device_id}
                    onClick={() => setActiveId(d.device_id)}
                    className={[
                      'flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-all',
                      activeId === d.device_id
                        ? 'border-[var(--color-signal)] bg-[var(--color-signal-soft)] shadow-sm'
                        : 'border-[var(--color-border)] bg-white hover:border-[var(--color-signal)]/40 hover:shadow-sm',
                    ].join(' ')}
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-xl">📱</span>
                      <span className="font-mono text-xs text-[var(--color-ink-dim)]">
                        {d.device_id}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-medium">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          background: d.connected
                            ? 'var(--color-healthy)'
                            : 'var(--color-critical)',
                          animation: d.connected ? 'pulse-dot 1.8s ease-in-out infinite' : 'none',
                        }}
                      />
                      {d.connected ? 'Live' : 'Offline'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── Active Device ── */}
      {devState && isDeviceConnected && (
        <>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
            {/* 3-D for mobile */}
            <div className="lg:col-span-3">
              <Card>
                <CardHeader
                  title="Live Device Twin"
                  subtitle="3-D model responds to real device orientation via accelerometer & gyroscope"
                  right={
                    <SeverityBadge
                      severity={devState.severity || 'NOT_CALIBRATED'}
                      pulse={devState.severity && !['NOT_CALIBRATED', 'SYNCHRONIZED', 'HEALTHY'].includes(devState.severity)}
                    />
                  }
                />
                <div className="p-4">
                  <Twin3DScene
                    variant="mobile"
                    real={devState.real}
                    twin={devState.twin}
                    severity={devState.severity || 'NOT_CALIBRATED'}
                    height={280}
                  />
                </div>
              </Card>
            </div>

            {/* Device stats + calibration */}
            <div className="space-y-4 lg:col-span-2">
              <Card>
                <CardHeader title="Device Status" />
                <div className="divide-y divide-[var(--color-border-soft)]">
                  {[
                    ['Device ID', devState.device_id, true],
                    [
                      'Calibration',
                      devState.calibrated
                        ? '✓ Calibrated'
                        : devState.calibrating
                        ? '⏳ Calibrating…'
                        : 'Not Calibrated',
                      false,
                    ],
                    [
                      'Twin Fidelity',
                      devState.twin_fidelity != null ? `${devState.twin_fidelity}%` : '—',
                      true,
                    ],
                    [
                      'Drift Probability',
                      devState.drift_probability != null
                        ? `${(devState.drift_probability * 100).toFixed(1)}%`
                        : '—',
                      true,
                    ],
                    [
                      'Sample Rate',
                      devState.sample_rate_hz != null
                        ? `${devState.sample_rate_hz} Hz`
                        : '—',
                      true,
                    ],
                  ].map(([label, value, mono]) => (
                    <div key={label} className="flex items-center justify-between px-5 py-2.5 text-xs">
                      <span className="text-[var(--color-ink-faint)]">{label}</span>
                      <span
                        className={mono ? 'font-mono font-medium text-[var(--color-ink)]' : 'text-[var(--color-ink)]'}
                      >
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Calibrate button */}
              {!devState.calibrated && (
                <Card>
                  <CardHeader
                    title="Calibrate Twin"
                    subtitle="Hold the device still on a flat surface for 6 seconds"
                  />
                  <div className="p-4 space-y-3">
                    <Button
                      onClick={calibrate}
                      disabled={busy || calibStatus === 'calibrating'}
                      className="w-full justify-center"
                    >
                      {calibStatus === 'calibrating' ? '⏳ Calibrating…' : '⚙ Calibrate Now'}
                    </Button>
                    {calibStatus === 'done' && (
                      <div className="space-y-2">
                        <p className="text-center text-xs text-[var(--color-healthy)]">
                          ✓ Calibration complete — twin is synchronized
                        </p>
                        <button
                          onClick={() => navigate('/dashboard')}
                          className="w-full rounded-xl bg-[var(--color-signal)] py-3 text-sm font-bold text-white hover:opacity-90"
                        >
                          → View Live Dashboard
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Go to dashboard if already calibrated */}
              {devState.calibrated && (
                <Card>
                  <div className="p-4">
                    <button
                      onClick={() => navigate('/dashboard')}
                      className="w-full rounded-xl bg-[var(--color-signal)] py-3 text-sm font-bold text-white hover:opacity-90"
                    >
                      → View Live Dashboard
                    </button>
                    <p className="mt-2 text-center text-xs text-[var(--color-ink-faint)]">
                      See real-time twin comparison and sensor trends
                    </p>
                  </div>
                </Card>
              )}
            </div>

          </div>

          {/* Drift injection for device */}
          {devState.calibrated && (
            <Card>
              <CardHeader
                title="Inject Device Drift"
                subtitle="Artificially perturb the mobile sensor stream to test the twin's drift detection response"
              />
              <div className="space-y-4 p-5">
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--color-ink-dim)]">
                      Drift Type
                    </label>
                    <select
                      value={driftType}
                      onChange={(e) => setDriftType(e.target.value)}
                      className="block rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-signal)] focus:outline-none focus:ring-1 focus:ring-[var(--color-signal)]"
                    >
                      {MOBILE_DRIFT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--color-ink-dim)]">
                      Severity: {driftSeverity.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0.2"
                      max="1"
                      step="0.05"
                      value={driftSeverity}
                      onChange={(e) => setDriftSeverity(parseFloat(e.target.value))}
                      className="block w-36 accent-[var(--color-signal)]"
                    />
                  </div>
                  <Button onClick={injectDrift}>⚡ Inject Drift</Button>
                  <Button variant="ghost" onClick={clearDrift}>
                    ✕ Clear
                  </Button>
                  <Button variant="danger" onClick={resetDevice} className="ml-auto">
                    Reset Device
                  </Button>
                </div>

                {devState.drift_injection?.active && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    ⚡ <strong>Active drift injection:</strong> {devState.drift_injection.drift_type}{' '}
                    — severity {devState.drift_injection.severity}
                  </div>
                )}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Device was selected but is now offline */}
      {devState && !isDeviceConnected && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[var(--color-border)] bg-white py-12 text-center">
          <span className="text-4xl">📡</span>
          <p className="text-sm font-semibold text-[var(--color-ink)]">Device disconnected</p>
          <p className="text-xs text-[var(--color-ink-faint)]">
            Reconnect the phone or select a different device above
          </p>
        </div>
      )}
    </div>
  )
}
