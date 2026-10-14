import {
  LineChart, Line, ScatterChart, Scatter, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, Cell, ZAxis,
} from 'recharts'

const GRID = 'var(--color-border-soft)'
const AXIS = 'var(--color-ink-faint)'
const TOOLTIP_STYLE = {
  background: 'var(--color-surface-raised)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--color-ink)',
}

export function TimeSeriesChart({ data, lines, xKey = 'step', height = 220 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: AXIS }} stroke={GRID} />
        <YAxis tick={{ fontSize: 11, fill: AXIS }} stroke={GRID} width={44} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: AXIS }} />
        {lines.map((l) => (
          <Line
            key={l.key}
            type="monotone"
            dataKey={l.key}
            name={l.name}
            stroke={l.color}
            strokeWidth={l.strokeWidth ?? 2}
            strokeDasharray={l.dashed ? '4 3' : undefined}
            dot={false}
            isAnimationActive={false}
          />
        ))}
        <Legend wrapperStyle={{ fontSize: 11, color: AXIS }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function CurveChart({ data, xKey, yKey, xLabel, yLabel, diagonal = false, height = 280, color = 'var(--color-signal)', baseline }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
        <XAxis dataKey={xKey} type="number" domain={[0, 1]} tick={{ fontSize: 11, fill: AXIS }} stroke={GRID}
          label={{ value: xLabel, position: 'insideBottom', offset: -4, fill: AXIS, fontSize: 11 }} />
        <YAxis dataKey={yKey} type="number" domain={[0, 1]} tick={{ fontSize: 11, fill: AXIS }} stroke={GRID} width={40}
          label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: AXIS, fontSize: 11 }} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        {diagonal && (
          <Line data={[{ [xKey]: 0, [yKey]: 0 }, { [xKey]: 1, [yKey]: 1 }]} dataKey={yKey} stroke={AXIS}
            strokeDasharray="4 4" dot={false} isAnimationActive={false} legendType="none" />
        )}
        {baseline !== undefined && (
          <ReferenceLine y={baseline} stroke="var(--color-minor)" strokeDasharray="4 4"
            label={{ value: `baseline ${baseline.toFixed(3)}`, fill: 'var(--color-minor)', fontSize: 10, position: 'insideTopRight' }} />
        )}
        <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

const CLASS_COLORS = { 0: 'var(--color-healthy)', 1: 'var(--color-critical)' }

export function ScatterPlot({ points, xKey = 'pc1', yKey = 'pc2', height = 380 }) {
  const healthy = points.filter((p) => p.label === 0)
  const drift = points.filter((p) => p.label === 1)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
        <XAxis dataKey={xKey} type="number" tick={{ fontSize: 11, fill: AXIS }} stroke={GRID} name={xKey.toUpperCase()} />
        <YAxis dataKey={yKey} type="number" tick={{ fontSize: 11, fill: AXIS }} stroke={GRID} name={yKey.toUpperCase()} width={44} />
        <ZAxis range={[18, 18]} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ strokeDasharray: '3 3' }} />
        <Legend wrapperStyle={{ fontSize: 11, color: AXIS }} />
        <Scatter name="Healthy" data={healthy} fill={CLASS_COLORS[0]} fillOpacity={0.55} />
        <Scatter name="Drift" data={drift} fill={CLASS_COLORS[1]} fillOpacity={0.55} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

export function HBarChart({ data, dataKey, labelKey, height = 320, color = 'var(--color-signal)', domain }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" domain={domain || ['auto', 'auto']} tick={{ fontSize: 11, fill: AXIS }} stroke={GRID} />
        <YAxis type="category" dataKey={labelKey} width={150} tick={{ fontSize: 10.5, fill: AXIS }} stroke={GRID} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey={dataKey} radius={[0, 3, 3, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.value < 0 ? 'var(--color-critical)' : color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function VBarChart({ data, dataKey, labelKey, height = 220, color = 'var(--color-signal)' }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={labelKey} tick={{ fontSize: 10, fill: AXIS }} stroke={GRID} />
        <YAxis tick={{ fontSize: 11, fill: AXIS }} stroke={GRID} width={40} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey={dataKey} fill={color} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function ConfusionMatrixGrid({ matrix, labels }) {
  const max = Math.max(...matrix.flat())
  const cells = []
  matrix.forEach((row, i) => {
    cells.push(
      <div key={`label-${i}`} className="flex items-center justify-end pr-2 text-[var(--color-ink-faint)]">
        actual<br /><span className="text-[var(--color-ink-dim)]">{labels[i]}</span>
      </div>
    )
    row.forEach((v, j) => {
      cells.push(
        <div
          key={`${i}-${j}`}
          className="flex aspect-square items-center justify-center rounded-md font-mono text-lg font-semibold"
          style={{
            background: `color-mix(in srgb, ${i === j ? 'var(--color-healthy)' : 'var(--color-critical)'} ${8 + (v / max) * 45}%, var(--color-surface-raised))`,
            color: 'var(--color-ink)',
          }}
        >
          {v}
        </div>
      )
    })
  })
  return (
    <div className="grid grid-cols-[auto_1fr_1fr] gap-1 text-center text-xs">
      <div />
      {labels.map((l) => (
        <div key={l} className="pb-1 text-[var(--color-ink-faint)]">predicted<br /><span className="text-[var(--color-ink-dim)]">{l}</span></div>
      ))}
      {cells}
    </div>
  )
}
