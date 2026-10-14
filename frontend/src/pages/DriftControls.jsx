import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useDevice } from '../context/DeviceContext'
import { Card, CardHeader, Button } from '../components/ui/Primitives'
import { SeverityBadge, StatusDot } from '../components/ui/SeverityBadge'
import { StatCard } from '../components/ui/StatCard'

/* ─── Industrial drift options ─── */
const IND_DRIFTS = [
  { type: 'gradual',             label: 'Gradual Drift',        hint: 'Slow ramp — temperature & vibration diverge steadily',  color: '#0d7d76' },
  { type: 'sudden',              label: 'Sudden Drift',         hint: 'Instant step-change across multiple sensor channels',   color: '#dc2626' },
  { type: 'temperature',         label: 'Temperature Channel',  hint: 'Isolate drift to the temperature sensor only',           color: '#ea580c' },
  { type: 'vibration',           label: 'Vibration Channel',    hint: 'Isolate drift to the vibration sensor only',             color: '#d97706' },
  { type: 'rpm',                 label: 'RPM Channel',          hint: 'Isolate drift to the RPM sensor only',                   color: '#7c3aed' },
  { type: 'multi_sensor',        label: 'Multi-Sensor',         hint: 'Temp + vibration + RPM + current diverge simultaneously', color: '#0369a1' },
  { type: 'noise',               label: 'Noise Increase',       hint: 'Gradual increase in sensor noise standard deviation',    color: '#475569' },
  { type: 'operating_condition', label: 'Condition Shift',      hint: 'Machine enters a new high-load operating regime',        color: '#0f766e' },
]

/* ─── Mobile drift options ─── */
const MOB_DRIFTS = [
  { type: 'gradual',    label: 'Gradual Drift',    hint: 'Slowly drifting motion baseline',                 color: '#0d7d76' },
  { type: 'sudden',     label: 'Sudden Drift',     hint: 'Abrupt step-change in sensor readings',           color: '#dc2626' },
  { type: 'gyro_scale', label: 'Gyro Scale Error', hint: 'Gyroscope gain increases over time',              color: '#7c3aed' },
  { type: 'accel_bias', label: 'Accel Bias Drift', hint: 'Accelerometer zero-offset shifts gradually',      color: '#d97706' },
  { type: 'noise',      label: 'Noise Increase',   hint: 'Random noise injected into the sensor stream',   color: '#475569' },
]


export default function DriftControls() {
  const { selectedDevice, deviceConfig, mobileDeviceId } = useDevice()
  const navigate = useNavigate()

  useEffect(() => {
    if (!selectedDevice) navigate('/', { replace: true })
  }, [selectedDevice, navigate])

  if (!selectedDevice) return null
  if (selectedDevice === 'mobile') return <MobileDriftControls mobileDeviceId={mobileDeviceId} deviceConfig={deviceConfig} />
  return <IndustrialDriftControls deviceConfig={deviceConfig} />
}

/* ═══════════════════════════════════════════════
   INDUSTRIAL DRIFT CONTROLS
═══════════════════════════════════════════════ */
function IndustrialDriftControls({ deviceConfig }) {
  const [state, setState] = useState(null)
  const [severity, setSeverity] = useState(0.85)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    const tick = () => api.currentState().then(s => alive && setState(s)).catch(() => {})
    tick(); const id = setInterval(tick, 1000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  const act = async (fn) => { setBusy(true); try { await fn() } finally { setBusy(false) } }
  const activeDrift = state?.drift_type && state.drift_type !== 'none' ? state.drift_type : null

  return (
    <DriftLayout
      deviceConfig={deviceConfig}
      title="Industrial Drift Controls"
      subtitle="Drive the machine simulator and inject faults into the physical side. The twin model stays unchanged — that divergence is what the ML system detects."
      isRunning={state?.running}
      kpis={[
        { label: 'Twin Fidelity', value: state ? state.twin_fidelity.toFixed(1) : '—', unit: '%', tone: 'signal' },
        { label: 'Drift Probability', value: state ? (state.drift_probability * 100).toFixed(1) : '—', unit: '%', tone: state?.drift_probability > 0.5 ? 'critical' : 'healthy' },
        { label: 'Severity', node: <div className="mt-3"><SeverityBadge severity={state?.severity || 'HEALTHY'} /></div> },
        { label: 'Active Drift', node: <div className="mt-2 font-mono text-sm text-[var(--color-ink)]">{activeDrift ? activeDrift.replace(/_/g, ' ') : 'none'}</div> },
      ]}
      playback={
        <div className="flex flex-wrap items-center gap-3 p-5">
          <Button onClick={() => act(api.simStart)} disabled={busy}>▶ Start</Button>
          <Button variant="outline" onClick={() => act(api.simPause)} disabled={busy}>⏸ Pause</Button>
          <Button variant="outline" onClick={() => act(() => api.simReset())} disabled={busy}>↺ Reset</Button>
          <Button variant="ghost" onClick={() => act(api.clearDrift)} disabled={busy}>✕ Clear Drift</Button>
        </div>
      }
      severitySlider={severity}
      onSeverityChange={setSeverity}
      driftOptions={IND_DRIFTS}
      activeDrift={activeDrift}
      onInjectDrift={(type) => act(() => api.injectDrift({ drift_type: type, severity }))}
      stateTable={state && Object.keys(state.real).map(sensor => ({
        sensor,
        real: state.real[sensor],
        twin: state.twin[sensor],
      }))}
    />
  )
}

/* ═══════════════════════════════════════════════
   MOBILE DRIFT CONTROLS
═══════════════════════════════════════════════ */
function MobileDriftControls({ mobileDeviceId, deviceConfig }) {
  const [devices, setDevices] = useState([])
  const [activeId, setActiveId] = useState(mobileDeviceId)
  const [devState, setDevState] = useState(null)
  const [severity, setSeverity] = useState(0.7)
  const [busy, setBusy] = useState(false)

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
    poll(); const id = setInterval(poll, 3000)
    return () => { alive = false; clearInterval(id) }
  }, [activeId])

  useEffect(() => {
    if (!activeId) return
    let alive = true
    const poll = () => api.mobileState(activeId).then(s => alive && setDevState(s)).catch(() => {})
    poll(); const id = setInterval(poll, 1000)
    return () => { alive = false; clearInterval(id) }
  }, [activeId])

  const act = async (fn) => { setBusy(true); try { await fn() } finally { setBusy(false) } }
  const activeDrift = devState?.drift_injection?.active ? devState.drift_injection.drift_type : null
  const isConnected = devState?.connected === true

  if (!isConnected) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-2xl border border-[var(--color-border)] bg-white p-10 shadow-sm">
          <div className="mb-3 text-4xl">📱</div>
          <h2 className="text-lg font-bold text-[var(--color-ink)]">No Phone Connected</h2>
          <p className="mt-1 text-sm text-[var(--color-ink-dim)]">Connect your phone first to access drift controls.</p>
          <a href="/connect">
            <button className="mt-5 rounded-xl bg-[var(--color-signal)] px-5 py-2.5 text-sm font-bold text-white hover:opacity-90">
              → Go to Device Connect
            </button>
          </a>
        </div>
      </div>
    )
  }

  return (
    <DriftLayout
      deviceConfig={deviceConfig}
      title="Mobile Drift Controls"
      subtitle="Inject artificial sensor drift into the phone's data stream to test the twin's detection capability."
      isRunning={isConnected}
      kpis={[
        { label: 'Twin Fidelity', value: devState?.twin_fidelity != null ? String(devState.twin_fidelity) : '—', unit: '%', tone: 'signal' },
        { label: 'Drift Probability', value: devState?.drift_probability != null ? (devState.drift_probability * 100).toFixed(1) : '—', unit: '%', tone: devState?.drift_probability > 0.5 ? 'critical' : 'healthy' },
        { label: 'Severity', node: <div className="mt-3"><SeverityBadge severity={devState?.severity || 'NOT_CALIBRATED'} /></div> },
        { label: 'Active Drift', node: <div className="mt-2 font-mono text-sm text-[var(--color-ink)]">{activeDrift || 'none'}</div> },
      ]}
      playback={
        <div className="flex flex-wrap items-center gap-3 p-5">
          <Button
            variant="ghost"
            onClick={() => act(() => api.mobileClearDrift(activeId))}
            disabled={busy || !activeDrift}
          >
            ✕ Clear Drift
          </Button>
          <Button
            variant="outline"
            onClick={() => act(() => api.mobileReset(activeId))}
            disabled={busy}
          >
            ↺ Reset Session
          </Button>
          {activeId && (
            <span className="ml-auto font-mono text-xs text-[var(--color-ink-faint)]">
              {activeId}
            </span>
          )}
        </div>
      }
      severitySlider={severity}
      onSeverityChange={setSeverity}
      driftOptions={MOB_DRIFTS}
      activeDrift={activeDrift}
      onInjectDrift={(type) =>
        act(() => api.mobileDrift({ device_id: activeId, drift_type: type, severity }))
      }
      stateTable={null}
    />
  )
}

/* ═══════════════════════════════════════════════
   SHARED DRIFT LAYOUT
═══════════════════════════════════════════════ */
function DriftLayout({
  deviceConfig, title, subtitle, isRunning,
  kpis, playback, severitySlider, onSeverityChange,
  driftOptions, activeDrift, onInjectDrift, stateTable,
}) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div
            className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider"
            style={{ color: deviceConfig?.accentColor || 'var(--color-signal)' }}
          >
            <span>{deviceConfig?.icon}</span> {deviceConfig?.name}
          </div>
          <h1 className="font-mono text-xl font-bold text-[var(--color-ink)]">{title}</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--color-ink-dim)]">{subtitle}</p>
        </div>
        <StatusDot ok={isRunning} label={isRunning ? 'Live' : 'Idle'} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.map((k) =>
          k.node ? (
            <div key={k.label} className="rounded-xl border border-[var(--color-border)] bg-white px-5 py-4 shadow-sm">
              <div className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-faint)]">{k.label}</div>
              {k.node}
            </div>
          ) : (
            <StatCard key={k.label} {...k} />
          )
        )}
      </div>

      {/* Playback */}
      <Card>
        <CardHeader title="Playback Controls" subtitle="Manage the simulation or device stream" />
        {playback}
      </Card>

      {/* Drift injection */}
      <Card>
        <CardHeader
          title="Inject Drift Scenario"
          subtitle="Drift is applied to the physical side only — the twin model is unaware, causing measurable divergence."
          right={
            <label className="flex items-center gap-2.5 text-xs text-[var(--color-ink-faint)]">
              Severity
              <input
                type="range" min="0.2" max="1" step="0.05"
                value={severitySlider}
                onChange={(e) => onSeverityChange(parseFloat(e.target.value))}
                className="w-24 accent-[var(--color-signal)]"
              />
              <span className="w-9 font-mono text-[var(--color-ink)]">{severitySlider.toFixed(2)}</span>
            </label>
          }
        />
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {driftOptions.map((d) => {
            const isActive = activeDrift === d.type
            return (
              <button
                key={d.type}
                onClick={() => onInjectDrift(d.type)}
                className="rounded-xl border bg-white text-left transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
                style={{
                  borderColor: isActive ? d.color : 'var(--color-border)',
                  borderLeftWidth: '3px',
                  borderLeftColor: d.color,
                  boxShadow: isActive ? `0 4px 16px ${d.color}18` : undefined,
                  background: isActive ? `${d.color}08` : 'white',
                }}
              >
                <div className="px-4 py-4">
                  <div
                    className="mb-3 h-1 w-6 rounded-full"
                    style={{ background: d.color }}
                  />
                  <div className="text-[13px] font-bold text-[var(--color-ink)]">{d.label}</div>
                  <div className="mt-1 text-[11px] leading-snug text-[var(--color-ink-faint)]">{d.hint}</div>
                  {isActive && (
                    <div
                      className="mt-3 text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: d.color }}
                    >
                      Active
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

      </Card>

      {/* State table (industrial only) */}
      {stateTable && stateTable.length > 0 && (
        <Card>
          <CardHeader title="Current Sensor State" subtitle="Live values — real device (green) vs twin prediction (blue)" />
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-b-xl bg-[var(--color-border-soft)] sm:grid-cols-3 lg:grid-cols-6">
            {stateTable.map(({ sensor, real, twin }) => (
              <div key={sensor} className="bg-white px-5 py-4">
                <div className="mb-2 text-[10px] uppercase tracking-wider text-[var(--color-ink-faint)]">{sensor}</div>
                <div className="font-mono text-sm font-bold text-[var(--color-signal)]">{real}</div>
                <div className="mt-0.5 font-mono text-xs text-[var(--color-info)]">↳ {twin}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
