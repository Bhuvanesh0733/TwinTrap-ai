import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { PageHeader, Card, CardHeader, Select, Button } from '../components/ui/Primitives'
import { CurveChart, ConfusionMatrixGrid } from '../components/charts/Charts'
import { StatCard } from '../components/ui/StatCard'

const MODELS = ['logistic_regression', 'random_forest', 'xgboost', 'mlp_neural_net']
const IMBALANCE_ORDER = ['balanced', 'moderate_90_10', 'high_95_5', 'severe_99_1']
const IMBALANCE_LABELS = { balanced: '50:50', moderate_90_10: '90:10', high_95_5: '95:5', severe_99_1: '99:1' }

export default function Evaluation() {
  const [model, setModel] = useState('random_forest')
  const [evalData, setEvalData] = useState(null)
  const [err, setErr] = useState(null)
  const [imbalance, setImbalance] = useState(null)
  const [loadingImbalance, setLoadingImbalance] = useState(false)

  useEffect(() => {
    setErr(null)
    api.evaluation(model).then(setEvalData).catch((e) => setErr(e.message))
  }, [model])

  const loadImbalance = async (refresh = false) => {
    setLoadingImbalance(true)
    try { setImbalance(await api.imbalanceExperiment('random_forest', refresh)) } finally { setLoadingImbalance(false) }
  }
  useEffect(() => { loadImbalance(false) }, [])

  const rocPoints = evalData?.roc_curve.fpr.map((x, i) => ({ fpr: x, tpr: evalData.roc_curve.tpr[i] })) || []
  const prPoints = evalData?.pr_curve.recall.map((x, i) => ({ recall: x, precision: evalData.pr_curve.precision[i] })) || []

  return (
    <div>
      <PageHeader
        eyebrow="Industrial Twin Simulation"
        title="Evaluation"
        description="ROC and Precision-Recall analysis, confusion matrix, and the balanced-vs-imbalanced comparison experiment."
        right={
          <Select value={model} onChange={(e) => setModel(e.target.value)}>
            {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        }
      />

      {err && <Card className="mb-6 px-5 py-4 text-sm text-[var(--color-critical)]">{err} — train models in Model Lab first.</Card>}

      {evalData && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
            {Object.entries(evalData.metrics).map(([k, v]) => (
              <StatCard key={k} label={k.replace('_', ' ')} value={v ?? '—'} />
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="ROC Curve" subtitle={`AUC = ${evalData.roc_curve.auc.toFixed(4)}`} />
              <div className="p-5">
                <CurveChart data={rocPoints} xKey="fpr" yKey="tpr" xLabel="False Positive Rate" yLabel="True Positive Rate" diagonal />
                <p className="mt-3 text-xs text-[var(--color-ink-faint)]">
                  ROC plots true-positive rate against false-positive rate across every threshold. It answers:
                  "how well does the model rank drift above healthy overall?" — but with rare drift events, the
                  false-positive rate stays small even when precision on actual drift cases is poor, which is why
                  we also look at Precision-Recall below.
                </p>
              </div>
            </Card>
            <Card>
              <CardHeader title="Precision-Recall Curve" subtitle={`Average Precision = ${evalData.pr_curve.average_precision.toFixed(4)}`} />
              <div className="p-5">
                <CurveChart data={prPoints} xKey="recall" yKey="precision" xLabel="Recall" yLabel="Precision"
                  baseline={evalData.pr_curve.baseline_prevalence} color="var(--color-info)" />
                <p className="mt-3 text-xs text-[var(--color-ink-faint)]">
                  Precision-Recall focuses entirely on the positive (DRIFT) class, so it is more sensitive to how the
                  model performs on the minority class specifically — the dashed line marks the dataset's drift
                  prevalence, i.e. what a random classifier would score.
                </p>
              </div>
            </Card>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Confusion Matrix" subtitle={`n_test = ${evalData.n_test}`} />
              <div className="p-5"><ConfusionMatrixGrid matrix={evalData.confusion_matrix.matrix} labels={['HEALTHY', 'DRIFT']} /></div>
            </Card>
            <Card>
              <CardHeader title="Classification Report" />
              <div className="overflow-x-auto p-5">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="text-[var(--color-ink-faint)] font-sans">
                      <th className="px-2 py-1.5">class</th><th className="px-2 py-1.5">precision</th><th className="px-2 py-1.5">recall</th><th className="px-2 py-1.5">f1</th><th className="px-2 py-1.5">support</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['HEALTHY', 'DRIFT'].map((cls) => {
                      const r = evalData.classification_report[cls]
                      return (
                        <tr key={cls} className="border-t border-[var(--color-border-soft)]">
                          <td className="px-2 py-1.5 font-sans">{cls}</td>
                          <td className="px-2 py-1.5">{r.precision.toFixed(3)}</td>
                          <td className="px-2 py-1.5">{r.recall.toFixed(3)}</td>
                          <td className="px-2 py-1.5">{r['f1-score'].toFixed(3)}</td>
                          <td className="px-2 py-1.5">{r.support}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}

      <Card className="mt-6">
        <CardHeader
          title="Balanced vs Imbalanced Experiment"
          subtitle="Random Forest retrained on 4 resampled configurations, same hyperparameters — isolates the effect of class imbalance"
          right={<Button size="sm" variant="outline" onClick={() => loadImbalance(true)} disabled={loadingImbalance}>Re-run</Button>}
        />
        {imbalance && (
          <>
            <div className="overflow-x-auto p-5">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[var(--color-ink-faint)]">
                    {['Config', 'Test drift %', 'Accuracy', 'Precision', 'Recall', 'F1', 'ROC-AUC', 'Avg Precision'].map((h) => (
                      <th key={h} className="px-3 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {IMBALANCE_ORDER.map((key) => {
                    const c = imbalance.configs[key]
                    if (!c) return null
                    return (
                      <tr key={key} className="border-t border-[var(--color-border-soft)]">
                        <td className="px-3 py-2 font-sans text-[var(--color-ink)]">{IMBALANCE_LABELS[key]}</td>
                        <td className="px-3 py-2">{(c.actual_test_drift_ratio * 100).toFixed(2)}%</td>
                        <td className="px-3 py-2">{c.metrics.accuracy}</td>
                        <td className="px-3 py-2">{c.metrics.precision}</td>
                        <td className="px-3 py-2">{c.metrics.recall}</td>
                        <td className="px-3 py-2">{c.metrics.f1}</td>
                        <td className="px-3 py-2">{c.metrics.roc_auc}</td>
                        <td className="px-3 py-2">{c.metrics.average_precision}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[var(--color-border-soft)] p-5">
              <div className="mb-1.5 text-xs font-medium text-[var(--color-ink)]">Auto-generated interpretation (from these exact numbers)</div>
              <p className="text-sm text-[var(--color-ink-dim)]">{imbalance.interpretation.summary_text}</p>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
