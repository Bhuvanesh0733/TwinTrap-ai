import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { api } from '../../services/api'
import { useDevice } from '../../context/DeviceContext'

const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/drift',     label: 'Drift Controls' },
  { to: '/connect',   label: 'Device Connect' },
]

export default function AppShell() {
  const [backendOk, setBackendOk] = useState(null)
  const { selectedDevice, deviceConfig, clearDevice } = useDevice()
  const navigate = useNavigate()

  useEffect(() => {
    let alive = true
    const check = () =>
      api.health()
        .then(() => alive && setBackendOk(true))
        .catch(() => alive && setBackendOk(false))
    check()
    const id = setInterval(check, 15000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-base)' }}>
      {/* ── Navbar ── */}
      <header
        className="sticky top-0 z-40"
        style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div className="mx-auto flex max-w-screen-xl items-center gap-4 px-6" style={{ height: 56 }}>

          {/* Logo */}
          <button
            onClick={() => navigate('/')}
            className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-75"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <polygon points="12,2 22,20 2,20" fill="none" stroke="var(--color-signal)" strokeWidth="1.8" strokeLinejoin="round" />
              <polygon points="12,7 18,18 6,18" fill="var(--color-signal)" fillOpacity="0.18" />
            </svg>
            <span className="font-mono text-[13px] font-bold tracking-wide text-[var(--color-ink)]">
              TwinTrap<span style={{ color: 'var(--color-signal)' }}>AI</span>
            </span>
          </button>

          {/* Divider */}
          <div className="h-4 w-px bg-[var(--color-border)]" />

          {/* Nav */}
          <nav className="flex items-center gap-0.5">
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  clsx(
                    'rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors',
                    isActive
                      ? 'bg-[var(--color-signal-soft)] text-[var(--color-signal)]'
                      : 'text-[var(--color-ink-dim)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-ink)]'
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex-1" />

          {/* Active device chip */}
          {selectedDevice && deviceConfig && (
            <div className="flex items-center gap-2.5">
              <div
                className="flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-medium"
                style={{
                  borderColor: `${deviceConfig.accentColor}25`,
                  background: deviceConfig.accentSoft,
                  color: deviceConfig.accentColor,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse-dot"
                  style={{ background: deviceConfig.accentColor }}
                />
                {deviceConfig.name}
              </div>
              <button
                onClick={() => { clearDevice(); navigate('/') }}
                className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[var(--color-ink-faint)] transition-colors hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-ink-dim)]"
              >
                Change
              </button>
            </div>
          )}

          {/* Backend status */}
          <div
            className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-white px-3 py-1.5 text-[11px] font-medium"
            style={{ color: backendOk === false ? 'var(--color-critical)' : 'var(--color-ink-faint)' }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: backendOk === true ? 'var(--color-healthy)' : backendOk === false ? 'var(--color-critical)' : 'var(--color-ink-faint)',
                animation: backendOk === true ? 'pulse-dot 2s ease-in-out infinite' : 'none',
              }}
            />
            {backendOk === true ? 'Online' : backendOk === false ? 'Offline' : 'Checking'}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-screen-xl px-6 py-4">
        <Outlet />
      </main>
    </div>
  )
}
