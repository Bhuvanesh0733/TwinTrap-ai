import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { PageHeader, Card, CardHeader, Button, Pill, Select } from '../components/ui/Primitives'
import { SeverityBadge, StatusDot } from '../components/ui/SeverityBadge'
import { StatCard } from '../components/ui/StatCard'
import { HBarChart } from '../components/charts/Charts'
import AlertBanner from '../components/ui/AlertBanner'
import Twin3DScene from '../components/three/Twin3DScene'

const DRIFT_TYPES = [
  { type: 'bias', label: 'Bias' },
  { type: 'spike', label: 'Spike' },
  { type: 'gradual', label: 'Gradual' },
  { type: 'noise', label: 'Noise' },
  { type: 'multi_sensor', label: 'Multi-sensor' },
]

export default function SmartphoneTwin() {
  const [devices, setDevices] = useState([])
  const [deviceId, setDeviceId] = useState(null)
  const [state, setState] = useState(null)
  const [calibrating, setCalibrating] = useState(false)
  const [shap, setShap] = useState(null)
  const [shapLoading, setShapLoading] = useState(false)

  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const d = await api.mobileDevices()
        if (!alive) return
        setDevices(d.devices)
        const active = deviceId || d.active_device_id
        if (active) {
          setDeviceId(active)
          const s = await api.mobileState(active)
          if (!alive) return
          setState(s)
        }
      } catch { /* backend not reachable yet */ }
    }
    tick()
    const id = setInterval(tick, 500)
    return () => { alive = false; clearInterval(id) }
  }, [deviceId])

  const doCalibrate = async () => {
    if (!deviceId) return
    setCalibrating(true)
    await api.mobileCalibrate(deviceId, 6)
    setTimeout(() => setCalibrating(false), 6500)
  }
  const doDrift = async (drift_type) => { if (deviceId) await api.mobileDrift({ drift_type, severity: 0.8, device_id: deviceId }) }
  const doExplain = async () => {
    if (!deviceId) return
    setShapLoading(true)
    try { setShap(await api.mobileShap(deviceId)) } catch { setShap(null) } finally { setShapLoading(false) }
  }

  const mobileUrl = `${window.location.protocol}//${window.location.hostname}:5173/mobile`
  const connected = state?.connected

  return (
    <div>
      <PageHeader
        eyebrow="Live Demonstration"
        title="Smartphone Live Twin"
        description="A real phone as the physical asset — motion sensors stream over WebSocket into the same discrepancy → ML → explanation pipeline."
        right={<StatusDot ok={connected} label={connected ? `Phone connected` : 'No phone connected'} />}
      />

      <Card className="mb-6 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-[var(--color-ink-dim)]">
            On your phone (same Wi-Fi), open: <span className="ml-1 font-mono text-[var(--color-signal)]">{mobileUrl}</span>
          </div>
          {devices.length > 1 && (
            <Select value={deviceId || ''} onChange={(e) => setDeviceId(e.target.value)}>
              {devices.map((d) => <option key={d.device_id} value={d.device_id}>{d.device_id}</option>)}
            </Select>
          )}
        </div>
      </Card>

      {connected && <AlertBanner severity={state.severity} detail={state.drift_injection?.active ? `${state.drift_injection.label}: ${state.drift_injection.drift_type}` : undefined} />}

      {!connected && (
        <Card className="px-5 py-14 text-center">
          <p className="text-sm text-[var(--color-ink)]">No smartphone has connected yet.</p>
          <p className="mt-1 text-xs text-[var(--color-ink-faint)]">Open the URL above on your phone and press "Start Telemetry".</p>
        </Card>
      )}

      {connected && (
        <>
          <Card>
            <CardHeader
              title="Physical device vs Digital Twin"
              subtitle="Drag to orbit. Tilt the phone — the twin (outline) stays at its calibrated baseline while the real phone (solid) moves."
              right={<SeverityBadge severity={state.severity} pulse={state.severity !== 'SYNCHRONIZED'} />}
            />
            <div className="p-5">
              <Twin3DScene variant="mobile" real={state.observed} twin={state.expected} severity={state.severity} />
            </div>
          </Card>

          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Twin Fidelity" value={state.twin_fidelity} unit="%" tone="signal" />
            <StatCard label="Divergence Probability" value={(state.divergence_probability * 100).toFixed(1)} unit="%"
              tone={state.divergence_probability > 0.5 ? 'critical' : 'healthy'} />
            <StatCard label="Calibration" value={state.calibrated ? 'Complete' : state.calibrating ? `${Math.round(state.calibration_progress * 100)}%` : 'Not calibrated'} />
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
              <div className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-faint)]">Calibrate</div>
              <Button size="sm" className="mt-2" onClick={doCalibrate} disabled={calibrating}>{calibrating ? 'Calibrating…' : 'Calibrate Twin'}</Button>
            </div>
          </div>

          <Card className="mt-6">
            <CardHeader title="Sensor readings" subtitle="Actual (measured) vs Twin (calibrated baseline)" />
            <div className="overflow-x-auto p-5">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-[var(--color-ink-faint)]">
                    <th className="px-3 py-2 font-medium">Channel</th>
                    <th className="px-3 py-2 font-medium">Actual</th>
                    <th className="px-3 py-2 font-medium">Twin</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {Object.entries(state.observed || {}).map(([k, v]) => (
                    <tr key={k} className="border-t border-[var(--color-border-soft)]">
                      <td className="px-3 py-2 font-sans text-[var(--color-ink)]">{k}</td>
                      <td className="px-3 py-2 text-[var(--color-ink)]">{v}</td>
                      <td className="px-3 py-2 text-[var(--color-info)]">{state.expected?.[k] ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="mt-6">
            <CardHeader title="Inject Drift" subtitle="SIMULATED SENSOR DRIFT layered on top of the real values — never a claim the phone's sensor itself failed" />
            <div className="flex flex-wrap gap-2 p-5">
              {DRIFT_TYPES.map((d) => (
                <Button key={d.type} size="sm" variant="outline" onClick={() => doDrift(d.type)}>{d.label}</Button>
              ))}
              <Button size="sm" variant="ghost" onClick={() => api.mobileClearDrift(deviceId)}>Clear</Button>
            </div>
          </Card>

          <Card className="mt-6">
            <CardHeader
              title="Why was divergence detected?"
              subtitle="On-demand SHAP explanation for the smartphone divergence model"
              right={<Button size="sm" variant="outline" onClick={doExplain} disabled={shapLoading || !state.model_available}>Explain Current Prediction</Button>}
            />
            <div className="p-5">
              {!state.model_available && <p className="text-sm text-[var(--color-ink-faint)]">Calibrate the twin first.</p>}
              {shap && <HBarChart height={220} data={shap.top_contributors.map((c) => ({ feature: c.feature, value: c.shap_value }))} dataKey="value" labelKey="feature" />}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
