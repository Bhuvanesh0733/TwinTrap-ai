const COPY = {
  MINOR_DIVERGENCE: { title: 'Minor divergence detected', tone: 'minor' },
  MEDIUM: { title: 'Medium drift detected', tone: 'minor' },
  SIGNIFICANT_DIVERGENCE: { title: 'Significant divergence detected', tone: 'significant' },
  HIGH: { title: 'High drift detected', tone: 'significant' },
  CRITICAL: { title: 'Critical drift detected', tone: 'critical' },
  CRITICAL_DIVERGENCE: { title: 'Critical divergence detected', tone: 'critical' },
}

const TONE_STYLE = {
  minor: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', icon: '#b45309' },
  significant: { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412', icon: '#c2410c' },
  critical: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', icon: '#dc2626' },
}

export default function AlertBanner({ severity, detail }) {
  const entry = COPY[severity]
  if (!entry) return null
  const s = TONE_STYLE[entry.tone]

  return (
    <div
      className="animate-slide-down mb-6 flex items-start gap-3 rounded-lg border px-4 py-3"
      style={{ background: s.bg, borderColor: s.border }}
    >
      <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-5 w-5 shrink-0" style={{ color: s.icon }}>
        <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div>
        <div className="text-sm font-semibold" style={{ color: s.text }}>{entry.title}</div>
        {detail && <div className="mt-0.5 text-xs" style={{ color: s.text, opacity: 0.85 }}>{detail}</div>}
      </div>
    </div>
  )
}
