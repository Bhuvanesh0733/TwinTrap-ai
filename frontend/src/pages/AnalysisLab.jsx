import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { PageHeader, Card, CardHeader, Select, Pill } from '../components/ui/Primitives'
import { ScatterPlot, VBarChart } from '../components/charts/Charts'
import { StatCard } from '../components/ui/StatCard'

const CONFIGS = [
  { value: 'balanced', label: 'Balanced (50:50)' },
  { value: 'moderate_90_10', label: 'Moderate (90:10)' },
  { value: 'high_95_5', label: 'High (95:5)' },
  { value: 'severe_99_1', label: 'Severe (99:1)' },
]

export default function AnalysisLab() {
  const [dataset, setDataset] = useState('balanced')
  const [pca, setPca] = useState(null)
  const [svd, setSvd] = useState(null)
  const [lda, setLda] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([api.pca(dataset), api.svd(dataset), api.lda(dataset)])
      .then(([p, s, l]) => { if (!alive) return; setPca(p); setSvd(s); setLda(l) })
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [dataset])

  const varianceData = pca?.explained_variance_ratio.map((v, i) => ({ pc: `PC${i + 1}`, variance: v })) || []
  const singularData = svd?.singular_values.map((v, i) => ({ pc: `σ${i + 1}`, value: v })) || []

  return (
    <div>
      <PageHeader
        eyebrow="Industrial Twin Simulation"
        title="PCA / SVD / LDA Lab"
        description="Unsupervised structure (PCA, SVD) and supervised separation (LDA) of the 30-dimensional discrepancy-feature space, fit on the train split only."
        right={
          <Select value={dataset} onChange={(e) => setDataset(e.target.value)}>
            {CONFIGS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        }
      />

      <Card>
        <CardHeader title="PCA — PC1 vs PC2" subtitle={pca ? `${pca.n_samples} training samples, ${pca.n_features} features -> 2D projection` : ''} />
        <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-[2fr_1fr]">
          {pca && <ScatterPlot points={pca.points} />}
          <div className="space-y-4">
            <StatCard label="PC1 explained variance" value={pca ? (pca.pc1_explained_variance * 100).toFixed(1) : '—'} unit="%" tone="signal" />
            <StatCard label="PC2 explained variance" value={pca ? (pca.pc2_explained_variance * 100).toFixed(1) : '—'} unit="%" />
            <StatCard label="Cumulative (PC1+PC2)" value={pca ? ((pca.pc1_explained_variance + pca.pc2_explained_variance) * 100).toFixed(1) : '—'} unit="%" />
          </div>
        </div>
        <div className="border-t border-[var(--color-border-soft)] p-5">
          <div className="mb-2 text-xs font-medium text-[var(--color-ink-dim)]">Explained variance per component</div>
          <VBarChart data={varianceData} dataKey="variance" labelKey="pc" height={160} />
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader title="SVD — explicit np.linalg.svd(X)" subtitle="Computed directly, not hidden inside PCA — X = U · diag(S) · Vᵀ" />
        <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-2">
          <div>
            <div className="grid grid-cols-3 gap-3">
              <MatrixCard name="U" shape={svd?.U_shape} desc="left singular vectors" />
              <MatrixCard name="Σ (S)" shape={svd?.S_shape} desc="singular values" />
              <MatrixCard name="Vᵀ" shape={svd?.Vt_shape} desc="right singular vectors" />
            </div>
            <div className="mt-4 space-y-2 text-xs text-[var(--color-ink-dim)]">
              <p><strong className="text-[var(--color-ink)]">U</strong> — {svd?.interpretation.U}</p>
              <p><strong className="text-[var(--color-ink)]">Σ</strong> — {svd?.interpretation.S}</p>
              <p><strong className="text-[var(--color-ink)]">Vᵀ</strong> — {svd?.interpretation.Vt}</p>
            </div>
            <div className="mt-3">
              <Pill tone={svd?.matches_pca ? 'healthy' : 'critical'}>
                {svd?.matches_pca ? 'Cross-checked: matches sklearn PCA explained variance' : 'Mismatch vs PCA (check console)'}
              </Pill>
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-medium text-[var(--color-ink-dim)]">Singular values (top {svd?.singular_values.length})</div>
            <VBarChart data={singularData} dataKey="value" labelKey="pc" height={260} color="var(--color-info)" />
          </div>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader title="LDA — supervised separation axis" subtitle={lda?.explanation} />
        <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-[2fr_1fr]">
          <div>
            <div className="mb-2 text-xs font-medium text-[var(--color-ink-dim)]">LD1 projection — Healthy vs Drift</div>
            <LdaStrip lda={lda} />
          </div>
          <div className="space-y-4">
            <StatCard label="Fisher separation ratio" value={lda?.fisher_separation_ratio?.toFixed(2) ?? '—'} tone="signal"
              hint="between-class variance / within-class variance" />
            <StatCard label="Healthy mean (LD1)" value={lda?.healthy_mean ?? '—'} />
            <StatCard label="Drift mean (LD1)" value={lda?.drift_mean ?? '—'} />
          </div>
        </div>
        <div className="border-t border-[var(--color-border-soft)] p-5">
          <div className="mb-2 text-xs font-medium text-[var(--color-ink-dim)]">Top features driving the LDA axis</div>
          <div className="flex flex-wrap gap-2">
            {lda?.top_features.map((f, i) => (
              <Pill key={f}>{f} <span className="font-mono text-[var(--color-ink-faint)]">{lda.top_feature_coefficients[i]}</span></Pill>
            ))}
          </div>
        </div>
      </Card>
      {loading && <p className="mt-4 text-xs text-[var(--color-ink-faint)]">Loading…</p>}
    </div>
  )
}

function MatrixCard({ name, shape, desc }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-3 text-center">
      <div className="font-mono text-lg text-[var(--color-signal)]">{name}</div>
      <div className="mt-1 font-mono text-xs text-[var(--color-ink)]">{shape ? shape.join(' × ') : '—'}</div>
      <div className="mt-1 text-[10px] text-[var(--color-ink-faint)]">{desc}</div>
    </div>
  )
}

function LdaStrip({ lda }) {
  if (!lda) return null
  const all = [...lda.ld1_healthy.map((v) => ({ v, label: 0 })), ...lda.ld1_drift.map((v) => ({ v, label: 1 }))]
  const min = Math.min(...all.map((d) => d.v))
  const max = Math.max(...all.map((d) => d.v))
  const pct = (v) => ((v - min) / (max - min || 1)) * 100
  return (
    <div className="relative h-32 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)]">
      {all.map((d, i) => (
        <div key={i}
          className="absolute h-2 w-2 -translate-x-1/2 rounded-full opacity-60"
          style={{
            left: `${pct(d.v)}%`,
            top: d.label === 0 ? '30%' : '65%',
            background: d.label === 0 ? 'var(--color-healthy)' : 'var(--color-critical)',
          }}
        />
      ))}
      <div className="absolute left-2 top-2 text-[10px] text-[var(--color-healthy)]">Healthy</div>
      <div className="absolute bottom-2 left-2 text-[10px] text-[var(--color-critical)]">Drift</div>
    </div>
  )
}
