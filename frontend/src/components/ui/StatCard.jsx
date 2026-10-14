import clsx from 'clsx'

export function StatCard({ label, value, unit, tone = 'default', hint, big = false }) {
  const tones = {
    default: 'var(--color-ink)',
    signal: 'var(--color-signal)',
    healthy: 'var(--color-healthy)',
    minor: 'var(--color-minor)',
    significant: 'var(--color-significant)',
    critical: 'var(--color-critical)',
  }
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
      <div className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-faint)]">{label}</div>
      <div
        className={clsx('mt-2 font-mono font-mono-tabular font-semibold', big ? 'text-4xl' : 'text-3xl')}
        style={{ color: tones[tone] }}
      >
        {value}
        {unit && <span className="ml-1 text-lg text-[var(--color-ink-faint)]">{unit}</span>}
      </div>
      {hint && <div className="mt-1.5 text-xs text-[var(--color-ink-faint)]">{hint}</div>}
    </div>
  )
}
