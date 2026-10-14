import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { PageHeader, Card, CardHeader, Button } from '../components/ui/Primitives'
import { SeverityBadge, StatusDot } from '../components/ui/SeverityBadge'
import { StatCard } from '../components/ui/StatCard'

const DRIFT_BUTTONS = [
  { type: 'gradual', label: 'Inject Gradual Drift', hint: 'Slow ramp across temperature/vibration/current' },
  { type: 'sudden', label: 'Inject Sudden Drift', hint: 'Instant jump across temperature/vibration/current' },
  { type: 'temperature', label: 'Inject Temperature Drift', hint: 'Only the temperature channel diverges' },
  { type: 'vibration', label: 'Inject Vibration Drift', hint: 'Only the vibration channel diverges' },
  { type: 'rpm', label: 'Inject RPM Drift', hint: 'Only the RPM channel diverges' },
  { type: 'multi_sensor', label: 'Inject Multi-Sensor Drift', hint: 'Temperature + vibration + rpm + current together' },
  { type: 'noise', label: 'Inject Noise Drift', hint: 'Sensor noise standard deviation increases' },
  { type: 'operating_condition', label: 'Shift Operating Condition', hint: 'Machine moves to an out-of-envelope high-load regime' },
]

export default function Simulation() {
  const [state, setState] = useState(null)
  const [severity, setSeverity] = useState(0.85)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    const tick = () => api.currentState().then((s) => alive && setState(s)).catch(() => {})
    tick()
    const id = setInterval(tick, 1000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  const act = async (fn) => {
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Industrial Twin Simulation"
        title="Simulation Controls"
        description="Drive the physical machine simulator and deliberately desynchronize the Digital Twin to demonstrate drift detection."
        right={<StatusDot ok={state?.running} label={state?.running ? 'Running' : 'Paused'} />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Twin Fidelity" value={state ? state.twin_fidelity.toFixed(1) : '—'} unit="%" tone="signal" />
        <StatCard label="Drift Probability" value={state ? (state.drift_probability * 100).toFixed(1) : '—'} unit="%"
          tone={state?.drift_probability > 0.5 ? 'critical' : 'healthy'} />
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-faint)]">Severity</div>
          <div className="mt-3"><SeverityBadge severity={state?.severity || 'HEALTHY'} /></div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-faint)]">Active drift</div>
          <div className="mt-2 font-mono text-sm text-[var(--color-ink)]">{state?.drift_type || 'none'}</div>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader title="Playback" subtitle="Advances one simulation step per second while running" />
        <div className="flex flex-wrap items-center gap-3 p-5">
          <Button onClick={() => act(api.simStart)} disabled={busy}>Start Simulation</Button>
          <Button variant="outline" onClick={() => act(api.simPause)} disabled={busy}>Pause</Button>
          <Button variant="outline" onClick={() => act(() => api.simReset())} disabled={busy}>Reset</Button>
          <Button variant="ghost" onClick={() => act(api.clearDrift)} disabled={busy}>Clear active drift</Button>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Inject Drift"
          subtitle="Applied to the REAL machine only — the twin keeps predicting from its unchanged model, which is what causes divergence"
          right={
            <label className="flex items-center gap-2 text-xs text-[var(--color-ink-faint)]">
              Severity
              <input type="range" min="0.2" max="1" step="0.05" value={severity}
                onChange={(e) => setSeverity(parseFloat(e.target.value))} className="accent-[var(--color-signal)]" />
              <span className="w-9 font-mono text-[var(--color-ink)]">{severity.toFixed(2)}</span>
            </label>
          }
        />
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {DRIFT_BUTTONS.map((d) => (
            <button
              key={d.type}
              disabled={busy}
              onClick={() => act(() => api.injectDrift({ drift_type: d.type, severity }))}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3.5 py-3 text-left text-xs transition-colors hover:border-[var(--color-signal)] disabled:opacity-40"
            >
              <div className="font-medium text-[var(--color-ink)]">{d.label}</div>
              <div className="mt-1 text-[var(--color-ink-faint)]">{d.hint}</div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Current machine vs twin state" />
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-md bg-[var(--color-border-soft)] p-px sm:grid-cols-3 lg:grid-cols-6">
          {state && Object.keys(state.real).map((sensor) => (
            <div key={sensor} className="bg-[var(--color-surface)] px-4 py-3">
              <div className="text-[10px] uppercase tracking-wider text-[var(--color-ink-faint)]">{sensor}</div>
              <div className="mt-1 font-mono text-sm text-[var(--color-signal)]">{state.real[sensor]}</div>
              <div className="font-mono text-xs text-[var(--color-info)]">twin {state.twin[sensor]}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
