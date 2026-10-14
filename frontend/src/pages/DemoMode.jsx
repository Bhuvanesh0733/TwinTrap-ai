import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Card, CardHeader, Pill, Button } from '../components/ui/Primitives'

const INDUSTRIAL_STEPS = [
  { title: 'Start in Simulation Mode', body: 'Open Dashboard, then Simulation. Press "Start Simulation" and let it run for a few seconds — the twin should track the real machine closely (fidelity ~95%+).' },
  { title: 'Introduce a fault', body: 'On the Simulation page, click "Inject Sudden Drift" or "Inject Gradual Drift". Watch Twin Fidelity fall and Drift Probability rise on the Dashboard.' },
  { title: 'Explain the detection', body: 'Open Explainability and pick a drifted sample (or the live one) to show the SHAP contributors driving the DRIFT classification.' },
  { title: 'Show the evidence', body: 'Open Evaluation for ROC/PR curves and the confusion matrix, and Model Lab for the model comparison table.' },
]

const MOBILE_STEPS = [
  { title: 'Open the mobile client', body: 'On the phone browser (same Wi-Fi), open the URL shown on the Smartphone Live Twin page.' },
  { title: 'Enable Motion Sensors', body: 'Tap "Enable Motion Sensors" on the phone and grant permission if prompted (required on iOS Safari).' },
  { title: 'Start Telemetry', body: 'Tap "Start Telemetry". The laptop dashboard should show "Phone Connected" within a second.' },
  { title: 'Calibrate Twin', body: 'Keep the phone still on a table and press "Calibrate Twin" (either on the phone or the laptop dashboard). Wait for "Twin Calibration: COMPLETE".' },
  { title: 'Show synchronized state', body: 'With the phone still, the dashboard should read Twin Status: SYNCHRONIZED and fidelity in the mid-to-high 90s.' },
  { title: 'Move the phone', body: 'Shake, rotate, or tilt the phone. Watch the live acceleration/gyroscope charts change in real time.' },
  { title: 'Inject simulated drift', body: 'On the laptop, click one of the "Inject Drift" buttons (e.g. Gradual). Watch severity progress SYNCHRONIZED → MINOR → SIGNIFICANT → CRITICAL.' },
  { title: 'Explain the divergence', body: 'Click "Explain Current Prediction" to show the SHAP-based contributors for the smartphone divergence model.' },
]

export default function DemoMode() {
  return (
    <div>
      <PageHeader
        eyebrow="Live Demonstration"
        title="Demo Mode"
        description="A guided walkthrough for presenting TwinTrap AI — works standalone (industrial simulation) or with a real phone attached."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChecklistCard title="Industrial Twin Simulation demo" steps={INDUSTRIAL_STEPS} cta={<Link to="/simulation"><Button size="sm">Open Simulation</Button></Link>} />
        <ChecklistCard title="Smartphone Live Twin demo" steps={MOBILE_STEPS} cta={<Link to="/smartphone"><Button size="sm">Open Smartphone Live Twin</Button></Link>} />
      </div>

      <Card className="mt-6 px-5 py-4">
        <div className="flex items-center gap-2">
          <Pill tone="signal">Networking note</Pill>
        </div>
        <p className="mt-2 text-sm text-[var(--color-ink-dim)]">
          Run the backend with <code className="font-mono text-xs text-[var(--color-ink)]">uvicorn app.main:app --host 0.0.0.0 --port 8000</code> and
          the frontend with <code className="font-mono text-xs text-[var(--color-ink)]">npm run dev -- --host 0.0.0.0</code> (already configured in
          vite.config.js), then find this laptop's local IP (see README) and open <code className="font-mono text-xs text-[var(--color-ink)]">http://&lt;that-ip&gt;:5173/mobile</code> on
          the phone. No IP address is hard-coded anywhere in the app.
        </p>
      </Card>
    </div>
  )
}

function ChecklistCard({ title, steps, cta }) {
  const [done, setDone] = useState({})
  return (
    <Card>
      <CardHeader title={title} right={cta} />
      <ol className="space-y-0 p-5">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-3 border-b border-[var(--color-border-soft)] py-3 last:border-0">
            <button
              onClick={() => setDone((d) => ({ ...d, [i]: !d[i] }))}
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-mono"
              style={{
                borderColor: done[i] ? 'var(--color-healthy)' : 'var(--color-border)',
                color: done[i] ? 'var(--color-healthy)' : 'var(--color-ink-faint)',
                background: done[i] ? 'color-mix(in srgb, var(--color-healthy) 15%, transparent)' : 'transparent',
              }}
            >
              {done[i] ? '✓' : i + 1}
            </button>
            <div>
              <div className={`text-sm font-medium ${done[i] ? 'text-[var(--color-ink-faint)] line-through' : 'text-[var(--color-ink)]'}`}>{s.title}</div>
              <div className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{s.body}</div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}
