import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { PageHeader, Card, CardHeader, Select, Button, Pill } from '../components/ui/Primitives'
import { Spinner } from '../components/ui/Primitives'
import { VBarChart, HBarChart, TimeSeriesChart } from '../components/charts/Charts'

const CONFIGS = [
  { value: 'balanced', label: 'Balanced (50:50)' },
  { value: 'moderate_90_10', label: 'Moderate (90:10)' },
  { value: 'high_95_5', label: 'High (95:5)' },
  { value: 'severe_99_1', label: 'Severe (99:1)' },
]
const BALANCING = [
  { value: 'class_weight', label: 'Class weighting' },
  { value: 'smote', label: 'SMOTE oversampling' },
  { value: 'none', label: 'None (baseline)' },
]
const TUNABLE = ['random_forest', 'xgboost']

export default function ModelLab() {
  const [dataset, setDataset] = useState('balanced')
  const [balancing, setBalancing] = useState('class_weight')
  const [comparison, setComparison] = useState(null)
  const [training, setTraining] = useState(false)
  const [trainInfo, setTrainInfo] = useState(null)

  const [tuneModel, setTuneModel] = useState('random_forest')
  const [gridResult, setGridResult] = useState(null)
  const [randomResult, setRandomResult] = useState(null)
  const [tuning, setTuning] = useState(null)

  const [cvModel, setCvModel] = useState('random_forest')
  const [cvResult, setCvResult] = useState(null)
  const [lcResult, setLcResult] = useState(null)
  const [running, setRunning] = useState(null)

  const [fiModel, setFiModel] = useState('random_forest')
  const [fi, setFi] = useState(null)

  useEffect(() => {
    api.modelComparison().then(setComparison).catch(() => {})
  }, [])

  useEffect(() => {
    if (comparison) api.featureImportance(fiModel).then(setFi).catch(() => setFi(null))
  }, [fiModel, comparison])

  const doTrain = async () => {
    setTraining(true)
    try {
      const res = await api.train({ dataset_name: dataset, balancing_strategy: balancing })
      setTrainInfo(res)
      setComparison({ comparison: res.comparison, dataset_name: res.dataset_name, active_model_id: res.active_model_id })
    } finally {
      setTraining(false)
    }
  }

  const doGrid = async () => {
    setTuning('grid')
    try { setGridResult(await api.tuneGrid(tuneModel)) } finally { setTuning(null) }
  }
  const doRandom = async () => {
    setTuning('random')
    try { setRandomResult(await api.tuneRandom(tuneModel, 10)) } finally { setTuning(null) }
  }
  const doCv = async () => {
    setRunning('cv')
    try { setCvResult(await api.crossValidate(cvModel, 5)) } finally { setRunning(null) }
  }
  const doLc = async () => {
    setRunning('lc')
    try { setLcResult(await api.learningCurve(cvModel)) } finally { setRunning(null) }
  }

  const lcData = lcResult?.train_sizes.map((n, i) => ({
    n, train: lcResult.train_score_mean[i], val: lcResult.val_score_mean[i],
  })) || []

  const fiData = fi?.available ? fi.features.slice(0, 12).map((f, i) => ({ feature: f, value: fi.importances_normalized[i] })) : []

  return (
    <div>
      <PageHeader
        eyebrow="Industrial Twin Simulation"
        title="Model Lab"
        description="Train and compare Logistic Regression, Random Forest, XGBoost, and an MLP; tune, cross-validate, and inspect learning curves."
      />

      <Card>
        <CardHeader
          title="Train all 4 models"
          subtitle="Fits on the training split, reports metrics on the held-out test split — nothing here is fabricated"
          right={
            <div className="flex items-center gap-2">
              <Select value={dataset} onChange={(e) => setDataset(e.target.value)}>
                {CONFIGS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
              <Select value={balancing} onChange={(e) => setBalancing(e.target.value)}>
                {BALANCING.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
              <Button size="sm" onClick={doTrain} disabled={training}>
                {training && <Spinner className="h-3.5 w-3.5" />} Train models
              </Button>
            </div>
          }
        />
        {comparison ? (
          <div className="overflow-x-auto p-5">
            {trainInfo?.smote_info && (
              <div className="mb-3 text-xs text-[var(--color-ink-faint)]">
                SMOTE: {trainInfo.smote_info.n_before} → {trainInfo.smote_info.n_after} training rows
                (k_neighbors={trainInfo.smote_info.k_neighbors})
              </div>
            )}
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[var(--color-ink-faint)]">
                  {['Model', 'Accuracy', 'Precision', 'Recall', 'F1', 'ROC-AUC', 'Avg Precision', 'Train time (s)'].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono">
                {comparison.comparison.map((row) => (
                  <tr key={row.model_id} className="border-t border-[var(--color-border-soft)]">
                    <td className="px-3 py-2 font-sans text-[var(--color-ink)]">
                      {row.model}
                      {row.model_id === comparison.active_model_id && <Pill tone="signal" className="ml-2">active</Pill>}
                    </td>
                    <td className="px-3 py-2">{row.accuracy}</td>
                    <td className="px-3 py-2">{row.precision}</td>
                    <td className="px-3 py-2">{row.recall}</td>
                    <td className="px-3 py-2">{row.f1}</td>
                    <td className="px-3 py-2">{row.roc_auc}</td>
                    <td className="px-3 py-2">{row.average_precision}</td>
                    <td className="px-3 py-2">{row.train_time_seconds}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-5 text-sm text-[var(--color-ink-faint)]">No models trained in this session yet — click Train models.</p>
        )}
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Hyperparameter tuning"
            subtitle="Small, bounded search spaces (see docs/methodology.md)"
            right={
              <Select value={tuneModel} onChange={(e) => setTuneModel(e.target.value)}>
                {TUNABLE.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            }
          />
          <div className="space-y-4 p-5">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={doGrid} disabled={!!tuning}>
                {tuning === 'grid' && <Spinner className="h-3.5 w-3.5" />} Run Grid Search
              </Button>
              <Button size="sm" variant="outline" onClick={doRandom} disabled={!!tuning}>
                {tuning === 'random' && <Spinner className="h-3.5 w-3.5" />} Run Random Search
              </Button>
            </div>
            <TuneResult title="GridSearchCV" result={gridResult} />
            <TuneResult title="RandomizedSearchCV" result={randomResult} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Cross-validation & learning curve"
            right={
              <Select value={cvModel} onChange={(e) => setCvModel(e.target.value)}>
                {['logistic_regression', 'random_forest', 'xgboost', 'mlp_neural_net'].map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            }
          />
          <div className="space-y-4 p-5">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={doCv} disabled={!!running}>
                {running === 'cv' && <Spinner className="h-3.5 w-3.5" />} Run 5-fold CV
              </Button>
              <Button size="sm" variant="outline" onClick={doLc} disabled={!!running}>
                {running === 'lc' && <Spinner className="h-3.5 w-3.5" />} Compute learning curve
              </Button>
            </div>
            {cvResult && (
              <div className="grid grid-cols-3 gap-2 text-xs">
                {Object.entries(cvResult.summary).map(([k, v]) => (
                  <div key={k} className="rounded-md border border-[var(--color-border)] px-2.5 py-2">
                    <div className="text-[var(--color-ink-faint)]">{k}</div>
                    <div className="font-mono text-[var(--color-ink)]">{v.mean} ± {v.std}</div>
                  </div>
                ))}
              </div>
            )}
            {lcResult && (
              <div>
                <div className="mb-1 text-xs text-[var(--color-ink-faint)]">Train vs validation F1 by training-set size</div>
                <TimeSeriesChart height={180} xKey="n" data={lcData} lines={[
                  { key: 'train', name: 'Train F1', color: 'var(--color-signal)' },
                  { key: 'val', name: 'Validation F1', color: 'var(--color-info)', dashed: true },
                ]} />
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Native feature importance"
          subtitle="Distinct from SHAP (see Explainability) — impurity-based for trees, |coefficient| for Logistic Regression"
          right={
            <Select value={fiModel} onChange={(e) => setFiModel(e.target.value)}>
              {['random_forest', 'xgboost', 'logistic_regression', 'mlp_neural_net'].map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          }
        />
        <div className="p-5">
          {fi?.available
            ? <HBarChart data={fiData} dataKey="value" labelKey="feature" height={340} />
            : <p className="text-sm text-[var(--color-ink-faint)]">{fi?.reason || 'Train a model first.'}</p>}
        </div>
      </Card>
    </div>
  )
}

function TuneResult({ title, result }) {
  if (!result) return null
  return (
    <div className="rounded-md border border-[var(--color-border)] p-3 text-xs">
      <div className="mb-1.5 font-medium text-[var(--color-ink)]">{title} — {result.elapsed_seconds}s</div>
      <div className="text-[var(--color-ink-faint)]">
        {result.n_combinations ?? result.n_combinations_total} combinations
        {result.n_iterations_sampled && ` · ${result.n_iterations_sampled} sampled`} · {result.cv_folds}-fold CV
      </div>
      <div className="mt-1.5 font-mono text-[var(--color-ink)]">best_params: {JSON.stringify(result.best_params)}</div>
      <div className="font-mono text-[var(--color-signal)]">best_cv_{result.scoring}: {result.best_cv_score}</div>
      <div className="mt-1 font-mono text-[var(--color-ink-dim)]">
        test: acc {result.test_metrics.accuracy} · f1 {result.test_metrics.f1} · roc_auc {result.test_metrics.roc_auc}
      </div>
    </div>
  )
}
