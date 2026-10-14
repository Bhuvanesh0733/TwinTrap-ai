import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { PageHeader, Card, CardHeader, Select, Pill } from '../components/ui/Primitives'
import { StatCard } from '../components/ui/StatCard'
import { VBarChart } from '../components/charts/Charts'

const CONFIGS = [
  { value: 'balanced', label: 'Balanced (50:50)' },
  { value: 'moderate_90_10', label: 'Moderate (90:10)' },
  { value: 'high_95_5', label: 'High (95:5)' },
  { value: 'severe_99_1', label: 'Severe (99:1)' },
]

export default function DatasetExplorer() {
  const [config, setConfig] = useState('balanced')
  const [summary, setSummary] = useState(null)
  const [sample, setSample] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([api.datasetSummary(config), api.datasetSample(config, 12), api.featureStats(config)])
      .then(([s, smp, st]) => { if (!alive) return; setSummary(s); setSample(smp); setStats(st) })
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [config])

  const driftTypeData = summary
    ? Object.entries(summary.drift_type_counts || {}).map(([k, v]) => ({ type: k, count: v }))
    : []

  return (
    <div>
      <PageHeader
        eyebrow="Industrial Twin Simulation"
        title="Dataset Explorer"
        description="Every row is labeled SIMULATION, so results are never confused with a real deployed sensor dataset."
        right={
          <Select value={config} onChange={(e) => setConfig(e.target.value)}>
            {CONFIGS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Rows" value={summary?.n_rows ?? '—'} tone="signal" />
        <StatCard label="Healthy / Drift" value={summary ? `${summary.n_healthy} / ${summary.n_drift}` : '—'} />
        <StatCard label="Drift ratio" value={summary ? (summary.drift_ratio * 100).toFixed(1) : '—'} unit="%" />
        <StatCard label="Features" value={summary?.n_features ?? '—'} hint="5 discrepancy features × 6 sensors" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Drift type distribution" subtitle="Count of rows labeled DRIFT, by injected drift_type" />
          <div className="p-5">
            {driftTypeData.length > 0
              ? <VBarChart data={driftTypeData} dataKey="count" labelKey="type" height={260} />
              : <p className="text-sm text-[var(--color-ink-faint)]">No drift rows in this configuration sample.</p>}
          </div>
        </Card>
        <Card>
          <CardHeader title="Data quality" />
          <div className="space-y-3 p-5 text-sm">
            <Row label="Missing values" value={summary?.missing_values_total ?? '—'} />
            <Row label="Duplicate rows" value={summary?.duplicate_rows ?? '—'} />
            <Row label="Episodes in pool" value={summary?.n_episodes ?? '—'} />
            <Row label="Source" value={summary ? Object.keys(summary.source_counts || {}).join(', ') : '—'} mono />
            <Row label="Operating conditions" value={summary ? Object.keys(summary.operating_condition_counts || {}).join(', ') : '—'} mono />
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Feature statistics" subtitle="Computed on this dataset configuration's rows (mean / std / min / max)" />
        <div className="overflow-x-auto p-5">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[var(--color-ink-faint)]">
                {['feature', 'mean', 'std', 'min', '25%', '50%', '75%', 'max', 'missing'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono">
              {stats?.stats?.slice(0, 30).map((row) => (
                <tr key={row.feature} className="border-t border-[var(--color-border-soft)]">
                  <td className="px-3 py-1.5 text-[var(--color-ink-dim)]">{row.feature}</td>
                  {['mean', 'std', 'min', '25%', '50%', '75%', 'max'].map((k) => (
                    <td key={k} className="px-3 py-1.5 text-[var(--color-ink)]">{Number(row[k]).toFixed(3)}</td>
                  ))}
                  <td className="px-3 py-1.5">{row.missing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Sample rows" subtitle="Random sample from the current configuration" />
        <div className="overflow-x-auto p-5">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[var(--color-ink-faint)]">
                {sample?.columns.map((c) => <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">{c}</th>)}
              </tr>
            </thead>
            <tbody className="font-mono">
              {sample?.rows.map((row, i) => (
                <tr key={i} className="border-t border-[var(--color-border-soft)]">
                  {sample.columns.map((c) => (
                    <td key={c} className="whitespace-nowrap px-3 py-1.5 text-[var(--color-ink)]">
                      {typeof row[c] === 'number' ? row[c].toFixed(3) : (
                        c === 'label' ? <Pill tone={row[c] ? 'critical' : 'healthy'}>{row[c] ? 'DRIFT' : 'HEALTHY'}</Pill> : String(row[c])
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {loading && <p className="mt-4 text-xs text-[var(--color-ink-faint)]">Loading…</p>}
    </div>
  )
}

function Row({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] pb-2 last:border-0">
      <span className="text-[var(--color-ink-faint)]">{label}</span>
      <span className={mono ? 'font-mono text-xs text-[var(--color-ink)]' : 'text-[var(--color-ink)]'}>{value}</span>
    </div>
  )
}
