import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useDevice } from '../context/DeviceContext'
import { Card, CardHeader } from '../components/ui/Primitives'
import { StatCard } from '../components/ui/StatCard'
import { SeverityBadge, StatusDot } from '../components/ui/SeverityBadge'
import { TimeSeriesChart } from '../components/charts/Charts'
import Twin3DScene from '../components/three/Twin3DScene'

/* ────────────────────────── INDUSTRIAL config ─────────────────────────── */
const IND_SENSORS = ['temperature', 'vibration', 'rpm', 'current', 'torque', 'pressure']
const IND_UNITS   = { temperature: '°C', vibration: 'mm/s', rpm: 'rpm', current: 'A', torque: 'Nm', pressure: 'bar' }
const IND_ICONS   = { temperature: 'T°', vibration: 'VIB', rpm: 'RPM', current: 'AMP', torque: 'TRQ', pressure: 'BAR' }

/* ────────────────────────── MOBILE config ─────────────────────────── */
const MOB_SENSORS = ['accel_x', 'accel_y', 'accel_z', 'gyro_alpha', 'gyro_beta', 'gyro_gamma']
const MOB_UNITS   = { accel_x: 'm/s²', accel_y: 'm/s²', accel_z: 'm/s²', gyro_alpha: '°/s', gyro_beta: '°/s', gyro_gamma: '°/s' }
const MOB_ICONS   = { accel_x: 'AX', accel_y: 'AY', accel_z: 'AZ', gyro_alpha: 'Gα', gyro_beta: 'Gβ', gyro_gamma: 'Gγ' }
const MOB_LABELS  = { accel_x: 'Accel X', accel_y: 'Accel Y', accel_z: 'Accel Z', gyro_alpha: 'Gyro Alpha', gyro_beta: 'Gyro Beta', gyro_gamma: 'Gyro Gamma' }

const MAX_HISTORY = 120

const SEVERITY_CONFIG = {
  HEALTHY:               { bg: 'var(--color-healthy-soft)',      border: '#bbf7d0', text: 'var(--color-healthy)',      dot: 'var(--color-healthy)',      msg: 'Systems Synchronized — Twin Fidelity Nominal' },
  SYNCHRONIZED:          { bg: 'var(--color-healthy-soft)',      border: '#bbf7d0', text: 'var(--color-healthy)',      dot: 'var(--color-healthy)',      msg: 'Systems Synchronized — Twin Fidelity Nominal' },
  LOW:                   { bg: 'var(--color-healthy-soft)',      border: '#bbf7d0', text: 'var(--color-healthy)',      dot: 'var(--color-healthy)',      msg: 'Low Divergence — Within Acceptable Bounds' },
  MINOR_DIVERGENCE:      { bg: 'var(--color-minor-soft)',        border: '#fde68a', text: 'var(--color-minor)',        dot: 'var(--color-minor)',        msg: 'Minor Divergence Detected' },
  MEDIUM:                { bg: 'var(--color-significant-soft)',  border: '#fed7aa', text: 'var(--color-significant)',  dot: 'var(--color-significant)',  msg: 'Significant Drift — Review Twin Calibration' },
  SIGNIFICANT_DIVERGENCE:{ bg: 'var(--color-significant-soft)',  border: '#fed7aa', text: 'var(--color-significant)',  dot: 'var(--color-significant)',  msg: 'Significant Drift — Review Twin Calibration' },
  HIGH:                  { bg: 'var(--color-critical-soft)',     border: '#fecaca', text: 'var(--color-critical)',     dot: 'var(--color-critical)',     msg: 'High Severity Drift — Immediate Action Required' },
  CRITICAL:              { bg: 'var(--color-critical-soft)',     border: '#fecaca', text: 'var(--color-critical)',     dot: 'var(--color-critical)',     msg: 'Critical — Twin Severely Desynchronized' },
  CRITICAL_DIVERGENCE:   { bg: 'var(--color-critical-soft)',     border: '#fecaca', text: 'var(--color-critical)',     dot: 'var(--color-critical)',     msg: 'Critical — Twin Severely Desynchronized' },
  NOT_CALIBRATED:        { bg: '#f0f9ff',                        border: '#bae6fd', text: '#0369a1',                  dot: '#0369a1',                   msg: 'Awaiting Calibration — Hold device still and tap Calibrate' },
}
const HEALTHY_SET = new Set(['HEALTHY', 'SYNCHRONIZED', 'LOW', 'NOT_CALIBRATED', undefined, null])


export default function Dashboard() {
  const { selectedDevice, deviceConfig, mobileDeviceId } = useDevice()
  const navigate = useNavigate()

  // Redirect to home if no device selected
  useEffect(() => {
    if (!selectedDevice) navigate('/', { replace: true })
  }, [selectedDevice, navigate])

  if (!selectedDevice) return null
  if (selectedDevice === 'mobile') return <MobileDashboard mobileDeviceId={mobileDeviceId} deviceConfig={deviceConfig} />
  return <IndustrialDashboard deviceConfig={deviceConfig} />
}

/* ═══════════════════════════════════════════════
   INDUSTRIAL DASHBOARD
═══════════════════════════════════════════════ */
function IndustrialDashboard({ deviceConfig }) {
  const [state, setState] = useState(null)
  const [history, setHistory] = useState([])
  const [error, setError] = useState(null)
  const timer = useRef(null)

  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const s = await api.currentState()
        if (!alive) return
        setState(s)
        setError(null)
        setHistory((h) => {
          const row = { step: s.step }
          IND_SENSORS.forEach((k) => { row[`real_${k}`] = s.real[k]; row[`twin_${k}`] = s.twin[k] })
          const next = [...h, row]
          return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next
        })
      } catch (e) { if (alive) setError(e.message) }
    }
    tick(); timer.current = setInterval(tick, 1000)
    return () => { alive = false; clearInterval(timer.current) }
  }, [])

  const severity = state?.severity || 'HEALTHY'
  const conf = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.HEALTHY
  const isAlert = !HEALTHY_SET.has(severity)
  const statusHealthy = state?.status?.startsWith('HEALTHY') || state?.status?.startsWith('SYNC')

  return (
    <DashboardLayout
      error={error}
      severity={severity}
      conf={conf}
      isAlert={isAlert}
      driftType={state?.drift_type}
      isRunning={state?.running}
      driftLink="/drift"
      kpis={[
        { label: 'Twin Fidelity', value: state ? state.twin_fidelity.toFixed(1) : '—', unit: '%', tone: 'signal' },
        { label: 'Drift Probability', value: state ? (state.drift_probability * 100).toFixed(1) : '—', unit: '%', tone: state?.drift_probability > 0.5 ? 'critical' : 'healthy' },
        { label: 'Status', value: statusHealthy ? 'Synced' : 'Drifted', tone: statusHealthy ? 'healthy' : 'critical', hint: state?.prediction_source?.startsWith('model') ? `via ${state.prediction_source.split(':')[1]}` : 'heuristic' },
        { label: 'Operating Condition', value: state?.operating_condition || '—' },
      ]}
      scene={<Twin3DScene variant="industrial" real={state?.real} twin={state?.twin} severity={severity} height={300} />}
      sceneTitle="Industrial Machine vs Digital Twin"
      sceneSubtitle="Solid mesh = real machine · Wireframe = twin prediction · Drag to orbit"
      sensors={IND_SENSORS}
      sensorIcons={IND_ICONS}
      sensorUnits={IND_UNITS}
      sensorLabels={null}
      realValues={state?.real}
      twinValues={state?.twin}
      discrepancy={state?.discrepancy_pct}
      history={history}
      deviceConfig={deviceConfig}
    />
  )
}

/* ═══════════════════════════════════════════════
   MOBILE DASHBOARD
═══════════════════════════════════════════════ */
function MobileDashboard({ mobileDeviceId, deviceConfig }) {
  const [devState, setDevState] = useState(null)
  const [devices, setDevices] = useState([])
  const [history, setHistory] = useState([])
  const [activeId, setActiveId] = useState(mobileDeviceId)
  const timer = useRef(null)
  const navigate = useNavigate()

  // Poll device list to find a connected device automatically
  useEffect(() => {
    let alive = true
    const poll = async () => {
      try {
        const r = await api.mobileDevices()
        if (!alive) return
        setDevices(r.devices || [])
        const connected = (r.devices || []).find(d => d.connected)
        if (connected && !activeId) setActiveId(connected.device_id)
      } catch { /* ignore */ }
    }
    poll(); const id = setInterval(poll, 3000)
    return () => { alive = false; clearInterval(id) }
  }, [activeId])

  // Poll active device state
  useEffect(() => {
    if (!activeId) return
    let alive = true
    const tick = async () => {
      try {
        const s = await api.mobileState(activeId)
        if (!alive) return
        setDevState(s)
        setHistory((h) => {
          const row = { step: Date.now() }
          // API returns observed_real (real sensor) and expected (twin prediction)
          const realSrc = s.observed_real ?? s.observed ?? {}
          const twinSrc = s.expected ?? {}
          MOB_SENSORS.forEach((k) => {
            row[`real_${k}`] = realSrc[k] ?? 0
            row[`twin_${k}`] = twinSrc[k] ?? 0
          })
          const next = [...h, row]
          return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next
        })
      } catch { /* ignore */ }
    }
    tick(); timer.current = setInterval(tick, 500)

    return () => { alive = false; clearInterval(timer.current) }
  }, [activeId])

  // Auto-detect best available device (prioritise connected ones)
  useEffect(() => {
    if (!activeId && devices.length > 0) {
      const connected = devices.find(d => d.connected)
      if (connected) setActiveId(connected.device_id)
      else if (devices[0]) setActiveId(devices[0].device_id)
    }
  }, [devices, activeId])

  const connectedDevices = devices.filter(d => d.connected)
  // Allow showing data even if currently disconnected (last known state)
  const hasData = devState != null
  const isConnected = devState?.connected === true

  if (!hasData && connectedDevices.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
        <div className="rounded-2xl border border-[var(--color-border)] bg-white p-10 shadow-sm">
          <div className="mb-4 text-5xl">📱</div>
          <h2 className="text-xl font-bold text-[var(--color-ink)]">No Phone Connected</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--color-ink-dim)]">
            Connect your smartphone to see its digital twin and live sensor comparison here.
          </p>
          <Link to="/connect">
            <button className="mt-6 rounded-xl bg-[var(--color-signal)] px-6 py-3 text-sm font-bold text-white hover:opacity-90">
              → Connect Your Phone
            </button>
          </Link>
        </div>
      </div>
    )
  }

  const severity = devState?.severity || 'NOT_CALIBRATED'
  const conf = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.NOT_CALIBRATED
  const isAlert = !HEALTHY_SET.has(severity)
  const fidelity = devState?.twin_fidelity

  // API uses `divergence_probability` (0-1)
  const driftProb = devState?.divergence_probability ?? null

  // API uses `observed_real` for the real sensor readings and `expected` for twin
  const realValues = devState?.observed_real ?? devState?.observed ?? null
  const twinValues = devState?.expected ?? null

  // API gives absolute `discrepancy` — convert to percentage relative to real value
  const discrepancyPct = {}
  MOB_SENSORS.forEach((k) => {
    const real = realValues?.[k] ?? 0
    const absDisc = devState?.discrepancy?.[k] ?? 0
    discrepancyPct[k] = real !== 0 ? (absDisc / Math.abs(real)) * 100 : 0
  })

  return (
    <DashboardLayout
      error={null}
      severity={severity}
      conf={conf}
      isAlert={isAlert}
      driftType={devState?.drift_injection?.active ? devState.drift_injection.drift_type : null}
      isRunning={isConnected}
      driftLink="/drift"
      kpis={[
        { label: 'Twin Fidelity', value: fidelity != null ? Number(fidelity).toFixed(1) : '—', unit: '%', tone: 'signal' },
        { label: 'Drift Probability', value: driftProb != null ? (driftProb * 100).toFixed(1) : '—', unit: '%', tone: driftProb > 0.5 ? 'critical' : 'healthy' },
        { label: 'Calibration', value: devState?.calibrated ? 'Calibrated' : 'Not Calibrated', tone: devState?.calibrated ? 'healthy' : 'minor', hint: devState?.device_id || '' },
        { label: 'Packets', value: devState?.packet_count != null ? String(devState.packet_count) : '—', hint: 'total frames received' },
      ]}
      scene={<Twin3DScene variant="mobile" real={realValues} twin={twinValues} severity={severity} height={300} />}
      sceneTitle="Smartphone vs Digital Twin"
      sceneSubtitle="3D model responds to real phone motion — solid = real · wireframe = twin"
      sensors={MOB_SENSORS}
      sensorIcons={MOB_ICONS}
      sensorUnits={MOB_UNITS}
      sensorLabels={MOB_LABELS}
      realValues={realValues}
      twinValues={twinValues}
      discrepancy={discrepancyPct}
      history={history}
      deviceConfig={deviceConfig}
      extraBanner={!devState?.calibrated && isConnected && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-5 py-3.5 text-sm text-sky-800">
          <strong>Action required:</strong> Go to{' '}
          <Link to="/connect" className="font-bold underline">Device Connect</Link>{' '}
          and calibrate your phone's twin to start drift detection.
        </div>
      )}
    />
  )
}


/* ═══════════════════════════════════════════════
   SHARED LAYOUT
═══════════════════════════════════════════════ */
function DashboardLayout({
  error, severity, conf, isAlert, driftType, isRunning, driftLink,
  kpis, scene, sceneTitle, sceneSubtitle,
  sensors, sensorIcons, sensorUnits, sensorLabels,
  realValues, twinValues, discrepancy, history,
  deviceConfig, extraBanner,
}) {
  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          Backend unreachable ({error}). Make sure uvicorn is running on port 8000.
        </div>
      )}

      {extraBanner}

      {/* Status Banner */}
      <div
        className="flex flex-wrap items-center gap-3 rounded-xl border px-5 py-3.5 transition-all duration-500"
        style={{ background: conf.bg, borderColor: conf.border, color: conf.text }}
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{
            background: conf.dot,
            animation: isAlert ? 'pulse-dot 0.9s ease-in-out infinite' : 'none',
          }}
        />
        <span className="text-sm font-semibold">{conf.msg}</span>
        {driftType && driftType !== 'none' && (
          <span
            className="rounded-md px-2.5 py-0.5 text-[11px] font-bold tracking-widest uppercase"
            style={{ background: 'rgba(255,255,255,0.55)', color: conf.text }}
          >
            {driftType.replace(/_/g, ' ')}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          <StatusDot ok={isRunning} label={isRunning ? 'Live' : 'Idle'} />
          <Link to={driftLink}>
            <button
              className="rounded-md border px-3 py-1 text-xs font-semibold transition-colors hover:opacity-80"
              style={{ borderColor: conf.border, background: 'rgba(255,255,255,0.5)', color: conf.text }}
            >
              Drift Controls →
            </button>
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.map((k) => (
          <StatCard key={k.label} {...k} />
        ))}
      </div>

      {/* 3D + Sensor Readings */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader
              title={sceneTitle}
              subtitle={sceneSubtitle}
              right={<SeverityBadge severity={severity} pulse={isAlert} />}
            />
            <div className="p-4">{scene}</div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="flex h-full flex-col">
            <CardHeader title="Sensor Readings" subtitle="Real device vs Digital Twin — current snapshot" />
            <div className="flex-1 divide-y divide-[var(--color-border-soft)]">
              {sensors.map((k) => {
                const pct = discrepancy?.[k] ?? 0
                const abs = Math.abs(pct)
                const barColor = abs > 15 ? 'var(--color-critical)' : abs > 5 ? 'var(--color-minor)' : 'var(--color-healthy)'
                const realVal = realValues?.[k]
                const twinVal = twinValues?.[k]
                const label = sensorLabels ? sensorLabels[k] : k
                return (
                  <div key={k} className="flex items-center gap-3 px-5 py-3">
                    {/* Clean label badge instead of emoji */}
                    <span
                      className="shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider"
                      style={{ background: 'var(--color-surface-raised)', color: 'var(--color-ink-dim)', minWidth: '2.6rem', textAlign: 'center' }}
                    >
                      {sensorIcons[k]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <span className="text-xs font-semibold capitalize text-[var(--color-ink-dim)]">{label}</span>
                        <span className="text-[10px] text-[var(--color-ink-faint)]">{sensorUnits[k]}</span>
                      </div>
                      <div className="flex items-center justify-between font-mono text-xs">
                        <span className="font-bold text-[var(--color-signal)]">
                          {realVal != null ? Number(realVal).toFixed(2) : '—'}
                        </span>

                        <span className="text-[var(--color-info)]">
                          {twinVal != null ? Number(twinVal).toFixed(2) : '—'}
                        </span>
                        <span className="text-[10px] text-[var(--color-ink-faint)]">{pct.toFixed(1)}%</span>
                      </div>
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--color-surface-raised)]">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(abs, 100)}%`, background: barColor }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center gap-5 border-t border-[var(--color-border-soft)] px-5 py-3 text-[10px] text-[var(--color-ink-faint)]">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: 'var(--color-signal)' }} /> Real Device
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-sm border-2" style={{ borderColor: 'var(--color-info)' }} /> Digital Twin
              </span>
            </div>
          </Card>
        </div>
      </div>

      {/* Trend Charts */}
      <Card>
        <CardHeader
          title="Sensor Trends"
          subtitle="Real device (solid) vs Digital Twin (dashed) — last 120 snapshots"
        />
        <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {sensors.map((k) => {
            const label = sensorLabels ? sensorLabels[k] : k
            return (
              <div key={k}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold capitalize text-[var(--color-ink-dim)]">
                    {sensorIcons[k]} {label}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--color-ink-faint)]">{sensorUnits[k]}</span>
                </div>
                <TimeSeriesChart
                  height={140}
                  data={history}
                  lines={[
                    { key: `real_${k}`, name: 'Device', color: 'var(--color-signal)' },
                    { key: `twin_${k}`, name: 'Twin', color: 'var(--color-info)', dashed: true },
                  ]}
                />
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
