import clsx from 'clsx'

export function Card({ className, children, ...rest }) {
  return (
    <div
      className={clsx(
        'rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]',
        className
      )}
      style={{ boxShadow: '0 1px 3px rgba(16,24,40,0.05), 0 3px 10px rgba(16,24,40,0.04)' }}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border-soft)] px-6 py-4">
      <div>
        <h3 className="text-[13px] font-semibold tracking-wide text-[var(--color-ink)]">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}


export function PageHeader({ eyebrow, title, description, right }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-border)] pb-5">
      <div>
        {eyebrow && (
          <div className="mb-1.5 text-xs font-medium text-[var(--color-signal)]">{eyebrow}</div>
        )}
        <h1 className="font-mono text-2xl font-semibold text-[var(--color-ink)]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-[var(--color-ink-dim)]">{description}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  )
}

export function Button({ className, variant = 'default', size = 'md', children, ...rest }) {
  const variants = {
    default: 'bg-[var(--color-signal)] text-white hover:bg-[#0a655f] font-medium shadow-sm',
    outline: 'border border-[var(--color-border)] bg-white text-[var(--color-ink)] hover:border-[var(--color-signal)] hover:text-[var(--color-signal)]',
    ghost: 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-raised)]',
    danger: 'border border-[var(--color-critical)]/30 text-[var(--color-critical)] hover:bg-[var(--color-critical)]/8',
  }
  const sizes = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3.5 py-2 text-sm',
  }
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Select({ className, ...rest }) {
  return (
    <select
      className={clsx(
        'rounded-md border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-signal)]',
        className
      )}
      {...rest}
    />
  )
}

export function Spinner({ className }) {
  return (
    <svg className={clsx('animate-spin', className)} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] bg-white px-6 py-16 text-center">
      <p className="text-sm font-medium text-[var(--color-ink)]">{title}</p>
      {description && <p className="max-w-sm text-xs text-[var(--color-ink-faint)]">{description}</p>}
      {action}
    </div>
  )
}

export function Pill({ children, tone = 'default', className }) {
  const tones = {
    default: 'bg-[var(--color-surface-raised)] text-[var(--color-ink-dim)] border-[var(--color-border)]',
    signal: 'bg-[var(--color-signal-soft)] text-[var(--color-signal)] border-transparent',
    healthy: 'bg-[var(--color-healthy)]/10 text-[var(--color-healthy)] border-transparent',
    critical: 'bg-[var(--color-critical)]/10 text-[var(--color-critical)] border-transparent',
  }
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium', tones[tone], className)}>
      {children}
    </span>
  )
}
