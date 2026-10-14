import { useNavigate } from 'react-router-dom'
import { useDevice, DEVICES } from '../context/DeviceContext'

export default function Home() {
  const { selectedDevice, selectDevice } = useDevice()
  const navigate = useNavigate()

  const handleSelect = (deviceId) => {
    selectDevice(deviceId)
    navigate(deviceId === 'mobile' ? '/connect' : '/dashboard')
  }

  return (
    <div className="min-h-[calc(100vh-56px)] flex flex-col">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-6 pb-6 pt-10 text-center">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-48"
          style={{
            background: 'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(13,125,118,0.07) 0%, transparent 70%)',
          }}
        />
        <div className="relative mx-auto max-w-xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-4 py-1.5 text-xs font-medium text-[var(--color-ink-dim)]"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-healthy)] animate-pulse-dot" />
            Machine Learning · Real-Time Monitoring
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--color-ink)] sm:text-4xl">
            Digital Twin
            <span className="block" style={{ color: 'var(--color-signal)' }}>Drift Detection</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-[var(--color-ink-dim)]">
            Connect a physical device, build its digital twin, and monitor
            synchronization in real time.
          </p>
        </div>
      </section>

      {/* ── Device Selection ── */}
      <section className="flex-1 px-6 pb-8">
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-faint)]">
            Select a device to begin
          </p>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {Object.values(DEVICES).map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                isSelected={selectedDevice === device.id}
                onSelect={() => handleSelect(device.id)}
              />
            ))}
          </div>

          {/* Capability strip */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              { label: 'Real-time sync', desc: 'Sub-second comparison between device and twin' },
              { label: 'XGBoost ML', desc: 'Trained drift classifier with probability scoring' },
              { label: 'Per-sensor breakdown', desc: 'Discrepancy bar per channel, live trends' },
            ].map((f) => (
              <div
                key={f.label}
                className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-3"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              >
                <p className="text-[12px] font-semibold text-[var(--color-ink)]">{f.label}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-ink-faint)]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="h-7 w-7">
      <rect x="10" y="4" width="20" height="32" rx="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M17 33h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 8h20M10 29h20" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.3" />
    </svg>
  )
}

function MachineIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="h-7 w-7">
      <rect x="4" y="14" width="32" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="13" cy="23" r="4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="27" cy="23" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M13 14V10M20 14V8M27 14V10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 23h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}


function DeviceCard({ device, isSelected, onSelect }) {
  const Icon = device.id === 'mobile' ? PhoneIcon : MachineIcon
  const isReal = device.available

  return (
    <button
      onClick={onSelect}
      className="group relative flex flex-col rounded-2xl border-2 bg-white p-5 text-left transition-all duration-200 hover:-translate-y-0.5"
      style={{
        borderColor: isSelected ? device.accentColor : 'var(--color-border)',
        boxShadow: isSelected
          ? `0 8px 30px ${device.accentColor}18, 0 2px 8px rgba(0,0,0,0.06)`
          : '0 1px 4px rgba(0,0,0,0.05)',
      }}
    >
      {/* Icon */}
      <div
        className="mb-4 inline-flex rounded-xl p-2.5"
        style={{ background: device.accentSoft, color: device.accentColor }}
      >
        <Icon />
      </div>

      {/* Mode tag */}
      <div className="mb-2 flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{ background: `${device.availabilityColor}12`, color: device.availabilityColor }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: device.availabilityColor }} />
          {isReal ? 'Real hardware' : 'Simulation'}
        </span>
      </div>

      <h3 className="text-base font-bold text-[var(--color-ink)]">{device.name}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-ink-dim)]">{device.description}</p>

      {/* Sensors */}
      <div className="mt-4 flex-1">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-faint)]">Channels</p>
        <div className="flex flex-wrap gap-1.5">
          {device.sensors.map((s) => (
            <span
              key={s}
              className="rounded-md px-2 py-0.5 text-[11px] font-medium"
              style={{ background: device.accentSoft, color: device.accentColor }}
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div
        className="mt-5 flex w-full items-center justify-center rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity group-hover:opacity-90"
        style={{ background: device.accentColor }}
      >
        {isReal ? 'Connect Device' : 'Run Simulation'}
        <svg className="ml-2 h-4 w-4" viewBox="0 0 16 16" fill="none">
          <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </button>

  )
}
