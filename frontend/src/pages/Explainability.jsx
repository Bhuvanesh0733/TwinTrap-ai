import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { PageHeader, Card, CardHeader, Select, Pill } from '../components/ui/Primitives'
import { HBarChart } from '../components/charts/Charts'
import { StatCard } from '../components/ui/StatCard'

const MODELS = ['random_forest', 'xgboost', 'logistic_regression', 'mlp_neural_net']

export default function Explainability() {
  const [model, setModel] = useState('random_forest')
  const [global_, setGlobal] = useState(null)
  const [samples, setSamples] = useState(null)
  const [selected, setSelected] = useState(null)
  const [local, setLocal] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    setErr(null)
    setGlobal(null); setSamples(null); setLocal(null); setSelected(null)
    api.shapGlobal(model).then(setGlobal).catch((e) => setErr(e.message))
    api.shapSamples(model, 15).then((s) => { setSamples(s); if (s.samples.length) selectSample(s.samples[0].sample_index) }).catch(() => {})
  }, [model])

  const selectSample = (idx) => {
    setSelected(idx)
    api.shapLocal(idx, model).then(setLocal).catch(() => setLocal(null))
  }

  const globalData = global_?.features.slice(0, 15).map((f, i) => ({ feature: f, value: global_.mean_abs_shap[i] })) || []
  const localData = local?.top_contributors.map((c) => ({ feature: c.feature, value: c.shap_value })) || []

  return (
    <div>
      <PageHeader
        eyebrow="Industrial Twin Simulation"
        title="Explainability"
        description="SHAP explains, in real numbers computed from the fitted model, which sensor discrepancies push a prediction toward DRIFT."
        right={
          <Select value={model} onChange={(e) => setModel(e.target.value)}>
            {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        }
      />

      {err && <Card className="mb-6 px-5 py-4 text-sm text-[var(--color-critical)]">{err} — train models in Model Lab first.</Card>}

      <Card>
        <CardHeader title="Global feature importance" subtitle={global_ ? `mean |SHAP value| over ${global_.n_samples_used} training samples` : ''} />
        <div className="p-5">{global_ && <HBarChart data={globalData} dataKey="value" labelKey="feature" height={380} />}</div>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Local explanation" subtitle="Pick a held-out test sample to see why the model classified it as it did" />
        <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-[1fr_1.4fr]">
          <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
            {samples?.samples.map((s) => (
              <button
                key={s.sample_index}
                onClick={() => selectSample(s.sample_index)}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                  selected === s.sample_index ? 'border-[var(--color-signal)] bg-[var(--color-signal)]/5' : 'border-[var(--color-border)] hover:border-[var(--color-border)]/70'
                }`}
              >
                <span className="font-mono text-[var(--color-ink-dim)]">sample #{s.sample_index}</span>
                <span className="flex items-center gap-2">
                  <Pill tone={s.true_label ? 'critical' : 'healthy'}>{s.true_label ? 'DRIFT' : 'HEALTHY'}</Pill>
                  <span className="font-mono text-[var(--color-ink)]">{(s.predicted_probability * 100).toFixed(1)}%</span>
                </span>
              </button>
            ))}
          </div>

          <div>
            {local && (
              <>
                <div className="mb-4 grid grid-cols-2 gap-3">
                  <StatCard label="Drift probability" value={(local.drift_probability * 100).toFixed(1)} unit="%"
                    tone={local.drift_probability > 0.5 ? 'critical' : 'healthy'} />
                  <StatCard label="True label" value={local.true_label ? 'DRIFT' : 'HEALTHY'} tone={local.true_label ? 'critical' : 'healthy'} />
                </div>
                <div className="mb-2 text-xs font-medium text-[var(--color-ink-dim)]">Top contributors</div>
                <HBarChart data={localData} dataKey="value" labelKey="feature" height={280} />
                <p className="mt-3 text-xs text-[var(--color-ink-faint)]">
                  Positive values push the prediction toward DRIFT; negative values push it toward HEALTHY.
                  Base value (model's average output over the background sample): {local.base_value ?? 'n/a'}
                </p>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
