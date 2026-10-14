import clsx from 'clsx'

// Maps every severity vocabulary used across the app (industrial LOW/MEDIUM/
// HIGH/CRITICAL and smartphone SYNCHRONIZED/MINOR/SIGNIFICANT/CRITICAL) to one
// consistent color system so a person reading both dashboards learns one code.
const SEVERITY_MAP = {
  HEALTHY: { label: 'Healthy', color: 'var(--color-healthy)' },
  SYNCHRONIZED: { label: 'Synchronized', color: 'var(--color-healthy)' },
  LOW: { label: 'Low', color: 'var(--color-healthy)' },
  MINOR_DIVERGENCE: { label: 'Minor divergence', color: 'var(--color-minor)' },
  MEDIUM: { label: 'Medium', color: 'var(--color-minor)' },
  SIGNIFICANT_DIVERGENCE: { label: 'Significant divergence', color: 'var(--color-significant)' },
  HIGH: { label: 'High', color: 'var(--color-significant)' },
  CRITICAL: { label: 'Critical', color: 'var(--color-critical)' },
  CRITICAL_DIVERGENCE: { label: 'Critical divergence', color: 'var(--color-critical)' },
  NOT_CALIBRATED: { label: 'Not calibrated', color: 'var(--color-info)' },
}

export function SeverityBadge({ severity, size = 'md', pulse = false }) {
  const entry = SEVERITY_MAP[severity] || { label: severity || 'Unknown', color: 'var(--color-ink-faint)' }
  const sizes = size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'
  return (
    <span
      className={clsx('inline-flex items-center gap-2 rounded-full border font-medium', sizes)}
      style={{ color: entry.color, borderColor: `color-mix(in srgb, ${entry.color} 40%, transparent)`, background: `color-mix(in srgb, ${entry.color} 10%, transparent)` }}
    >
      <span
        className={clsx('h-1.5 w-1.5 rounded-full', pulse && 'animate-pulse-dot')}
        style={{ background: entry.color }}
      />
      {entry.label}
    </span>
  )
}

export function StatusDot({ ok, label }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-[var(--color-ink-dim)]">
      <span
        className={clsx('h-2 w-2 rounded-full', ok ? 'animate-pulse-dot' : '')}
        style={{ background: ok ? 'var(--color-healthy)' : 'var(--color-critical)' }}
      />
      {label}
    </span>
  )
}

export default SEVERITY_MAP
