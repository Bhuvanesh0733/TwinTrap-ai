import { useEffect, useRef, useState } from 'react'
import { WS_BASE } from '../services/api'

function getDeviceId() {
  let id = localStorage.getItem('twintrap_device_id')
  if (!id) {
    id = 'phone-' + Math.random().toString(36).slice(2, 8)
    localStorage.setItem('twintrap_device_id', id)
  }
  return id
}

const MOTION_SUPPORTED =
  typeof window !== 'undefined' && 'DeviceMotionEvent' in window

const COLOR = {
  primary: '#0d7d76',
  red: '#dc2626',
  amber: '#b45309',
  green: '#16a34a',
  gray: '#6b7280',
  faint: '#9ca3af',
  border: '#e5e7eb',
  bg: '#f8fafc',
  white: '#ffffff',
  ink: '#12161c',
}

export default function MobileClient() {
  const [deviceId] = useState(getDeviceId)
  const [permission, setPermission] = useState(
    MOTION_SUPPORTED ? 'unknown' : 'unsupported'
  )
  const [streaming, setStreaming] = useState(false)
  const [wsStatus, setWsStatus] = useState('disconnected')
  const [latest, setLatest] = useState(null)
  const [twinState, setTwinState] = useState(null)
  const [rate, setRate] = useState(0)
  const [calibrating, setCalibrating] = useState(false)
  const [calibDone, setCalibDone] = useState(false)

  const wsRef = useRef(null)
  const motionRef = useRef({ x: 0, y: 0, z: 9.8 })
  const rotRef = useRef({ alpha: 0, beta: 0, gamma: 0 })
  const countRef = useRef(0)
  const intervalRef = useRef(null)

  /* motion listener */
  useEffect(() => {
    const onMotion = (e) => {
      const acc = e.accelerationIncludingGravity || e.acceleration
      if (acc) motionRef.current = { x: acc.x ?? 0, y: acc.y ?? 0, z: acc.z ?? 9.8 }
      const rot = e.rotationRate
      if (rot) rotRef.current = { alpha: rot.alpha ?? 0, beta: rot.beta ?? 0, gamma: rot.gamma ?? 0 }
      countRef.current += 1
    }
    window.addEventListener('devicemotion', onMotion)
    return () => window.removeEventListener('devicemotion', onMotion)
  }, [])

  /* sample rate counter */
  useEffect(() => {
    const id = setInterval(() => {
      setRate(countRef.current * 2)
      countRef.current = 0
    }, 500)
    return () => clearInterval(id)
  }, [])

  const requestPermission = async () => {
    try {
      if (
        typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function'
      ) {
        const res = await DeviceMotionEvent.requestPermission()
        setPermission(res === 'granted' ? 'granted' : 'denied')
      } else if (MOTION_SUPPORTED) {
        setPermission('granted')
      } else {
        setPermission('unsupported')
      }
    } catch {
      setPermission('denied')
    }
  }

  const connectAndStream = () => {
    if (wsRef.current) return
    const ws = new WebSocket(`${WS_BASE}/ws/mobile-sensor`)
    wsRef.current = ws
    setWsStatus('connecting')

    ws.onopen = () => {
      setWsStatus('connected')
      setStreaming(true)
      intervalRef.current = setInterval(() => {
        const m = motionRef.current
        const r = rotRef.current
        const packet = {
          device_id: deviceId,
          timestamp: Date.now() / 1000,
          accel_x: m.x,
          accel_y: m.y,
          accel_z: m.z,
          gyro_alpha: r.alpha,
          gyro_beta: r.beta,
          gyro_gamma: r.gamma,
        }
        setLatest(packet)
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(packet))
      }, 100)
    }
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data)
        if (msg.type === 'state') setTwinState(msg)
      } catch { /* ignore */ }
    }
    ws.onclose = () => {
      setWsStatus('disconnected')
      setStreaming(false)
      wsRef.current = null
      clearInterval(intervalRef.current)
    }
    ws.onerror = () => setWsStatus('error')
  }

  const stopStreaming = () => {
    clearInterval(intervalRef.current)
    wsRef.current?.close()
    wsRef.current = null
    setStreaming(false)
    setWsStatus('disconnected')
  }

  const calibrate = async () => {
    setCalibrating(true)
    setCalibDone(false)
    try {
      const base = WS_BASE.replace(/^ws/, 'http')
      await fetch(`${base}/api/mobile/calibrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, duration_seconds: 6 }),
      })
    } finally {
      setTimeout(() => {
        setCalibrating(false)
        setCalibDone(true)
      }, 6500)
    }
  }

  /* Derived */
  const statusColorMap = {
    connected: COLOR.green,
    connecting: COLOR.amber,
    disconnected: COLOR.red,
    error: COLOR.red,
  }
  const statusLabelMap = {
    connected: 'Connected',
    connecting: 'Connecting…',
    disconnected: 'Disconnected',
    error: 'Error',
  }
  const wsColor = statusColorMap[wsStatus] || COLOR.faint
  const wsLabel = statusLabelMap[wsStatus] || wsStatus

  const fidelity = twinState?.twin_fidelity
  const fidelityColor =
    fidelity == null ? COLOR.gray : fidelity > 90 ? COLOR.green : fidelity > 70 ? COLOR.amber : COLOR.red

  const s = (obj) => ({ ...obj })

  return (
    <div
      style={s({
        minHeight: '100dvh',
        background: COLOR.bg,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        color: COLOR.ink,
      })}
    >
      {/* Header */}
      <div
        style={s({
          background: COLOR.white,
          borderBottom: `1px solid ${COLOR.border}`,
          padding: '14px 20px',
          paddingTop: 'max(14px, env(safe-area-inset-top))',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        })}
      >
        <div style={s({ display: 'flex', alignItems: 'center', gap: 10 })}>
          {/* Logo */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <polygon
              points="12,2 22,20 2,20"
              fill="none"
              stroke={COLOR.primary}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <polygon points="12,7 18,18 6,18" fill={COLOR.primary} fillOpacity="0.2" />
          </svg>
          <div>
            <div
              style={s({
                fontFamily: 'monospace',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.05em',
                lineHeight: 1,
              })}
            >
              TWINTRAP AI
            </div>
            <div
              style={s({
                fontSize: 9,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: COLOR.faint,
                marginTop: 3,
              })}
            >
              Device Sensor Client
            </div>
          </div>
          {/* WS Status */}
          <div
            style={s({
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: wsColor,
            })}
          >
            <span
              style={s({
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: wsColor,
                display: 'inline-block',
              })}
            />
            {wsLabel}
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        style={s({
          padding: '20px',
          maxWidth: 420,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
        })}
      >
        {/* Device info card */}
        <InfoCard title="Device Info">
          <InfoRow label="ID" value={deviceId} mono />
          <InfoRow label="Rate" value={`${rate} Hz`} mono />
          <InfoRow
            label="Motion"
            value={
              permission === 'granted'
                ? '✓ Enabled'
                : permission === 'denied'
                ? '✗ Denied'
                : permission === 'unsupported'
                ? 'Not supported'
                : 'Not enabled'
            }
          />
          {twinState?.calibrated && (
            <InfoRow
              label="Fidelity"
              value={`${fidelity}%`}
              valueColor={fidelityColor}
              mono
            />
          )}
          {twinState && !twinState.calibrated && (
            <InfoRow label="Status" value="Calibration required" />
          )}
        </InfoCard>

        {/* Not supported warning */}
        {!MOTION_SUPPORTED && (
          <Alert color={COLOR.red} bg="#fef2f2" border="#fecaca">
            Motion sensors not available. Use <strong>Chrome on Android</strong> or{' '}
            <strong>Safari on iOS</strong>.
          </Alert>
        )}

        {/* Permission */}
        {permission === 'denied' && (
          <Alert color={COLOR.amber} bg="#fffbeb" border="#fde68a">
            Permission denied. Go to <strong>Settings → Browser → Motion &amp; Orientation Access</strong>.
          </Alert>
        )}

        {/* Action buttons */}
        {MOTION_SUPPORTED && permission !== 'granted' && (
          <Btn onClick={requestPermission} bg={COLOR.primary}>
            Enable Motion Sensors
          </Btn>
        )}

        {permission === 'granted' && !streaming && (
          <Btn onClick={connectAndStream} bg={COLOR.primary}>
            ▶ Start Telemetry
          </Btn>
        )}

        {streaming && (
          <>
            <Btn onClick={stopStreaming} bg={COLOR.red}>
              ⏹ Stop Telemetry
            </Btn>
            <Btn
              onClick={calibrate}
              bg={calibrating ? COLOR.amber : COLOR.gray}
              disabled={calibrating}
            >
              {calibrating ? '⏳ Calibrating — keep still…' : '⚙ Calibrate Twin (6 s)'}
            </Btn>
            {calibDone && !calibrating && (
              <div
                style={s({
                  textAlign: 'center',
                  fontSize: 13,
                  fontWeight: 600,
                  color: COLOR.green,
                })}
              >
                ✓ Calibration complete — twin synchronised
              </div>
            )}
          </>
        )}

        {/* Twin Fidelity */}
        {twinState?.calibrated && fidelity != null && (
          <InfoCard title="Twin Fidelity">
            <div
              style={s({
                textAlign: 'center',
                padding: '12px 0 4px',
              })}
            >
              <div
                style={s({
                  fontFamily: 'monospace',
                  fontSize: 52,
                  fontWeight: 800,
                  color: fidelityColor,
                  lineHeight: 1,
                })}
              >
                {fidelity}%
              </div>
              <div
                style={s({ fontSize: 11, color: COLOR.faint, marginTop: 6 })}
              >
                {fidelity > 90 ? 'Healthy' : fidelity > 70 ? 'Minor divergence' : 'Significant drift'}
              </div>
            </div>
            {twinState.drift_injection?.active && (
              <div
                style={s({
                  marginTop: 10,
                  padding: '10px 14px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 10,
                  fontSize: 12,
                  color: COLOR.red,
                  fontWeight: 600,
                })}
              >
                ⚡ Drift Active:{' '}
                {twinState.drift_injection.drift_type?.replace(/_/g, ' ')}
              </div>
            )}
          </InfoCard>
        )}

        {/* Live sensor values */}
        {latest && (
          <InfoCard title="Live Sensors">
            <div style={s({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 })}>
              <SensorBlock
                title="Accelerometer"
                rows={[
                  ['X', latest.accel_x],
                  ['Y', latest.accel_y],
                  ['Z', latest.accel_z],
                ]}
              />
              <SensorBlock
                title="Gyroscope"
                rows={[
                  ['α', latest.gyro_alpha],
                  ['β', latest.gyro_beta],
                  ['γ', latest.gyro_gamma],
                ]}
              />
            </div>
          </InfoCard>
        )}

        {/* Privacy note */}
        <p
          style={s({
            textAlign: 'center',
            fontSize: 10,
            color: COLOR.faint,
            lineHeight: 1.5,
          })}
        >
          Only motion & orientation data is used.
          <br />
          No contacts, camera, photos, or microphone.
        </p>
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function InfoCard({ title, children }) {
  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: 14,
        border: `1px solid ${COLOR.border}`,
        padding: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: COLOR.faint,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

function InfoRow({ label, value, mono, valueColor }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 0',
        borderBottom: `1px solid #f3f4f6`,
        fontSize: 12,
      }}
    >
      <span style={{ color: COLOR.faint }}>{label}</span>
      <span
        style={{
          fontFamily: mono ? 'monospace' : undefined,
          color: valueColor || COLOR.ink,
          fontWeight: 600,
        }}
      >
        {value}
      </span>
    </div>
  )
}

function Alert({ children, color, bg, border }) {
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 12,
        padding: '12px 16px',
        fontSize: 12,
        color,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  )
}

function Btn({ children, onClick, bg, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '17px 20px',
        borderRadius: 14,
        border: 'none',
        background: disabled ? '#e5e7eb' : bg,
        color: '#ffffff',
        fontSize: 15,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'opacity 0.15s',
        letterSpacing: '0.01em',
      }}
    >
      {children}
    </button>
  )
}

function SensorBlock({ title, rows }) {
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: COLOR.faint,
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      {rows.map(([k, v]) => (
        <div
          key={k}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            marginBottom: 4,
          }}
        >
          <span style={{ color: COLOR.gray }}>{k}</span>
          <span style={{ fontFamily: 'monospace', color: COLOR.ink, fontWeight: 600 }}>
            {Number(v).toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  )
}
