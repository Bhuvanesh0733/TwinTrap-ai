import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

const SEVERITY_COLOR = {
  HEALTHY: '#16a34a', SYNCHRONIZED: '#16a34a', LOW: '#16a34a',
  MEDIUM: '#b45309', MINOR_DIVERGENCE: '#b45309',
  HIGH: '#c2410c', SIGNIFICANT_DIVERGENCE: '#c2410c',
  CRITICAL: '#dc2626', CRITICAL_DIVERGENCE: '#dc2626',
  NOT_CALIBRATED: '#2563eb',
}
const TWIN_COLOR = '#2563eb'

function tiltFromAccel(ax = 0, ay = 0, az = 9.8) {
  const pitch = Math.atan2(-ax, Math.sqrt(ay * ay + az * az))
  const roll = Math.atan2(ay, az)
  return { pitch, roll }
}

function DeviceBox({ position, size, color, rotation, jitter = 0, alert = false, wireframe = false, opacity = 1, spin = 0 }) {
  const ref = useRef()
  const matRef = useRef()
  const spinRef = useRef(0)

  useFrame((state, delta) => {
    if (!ref.current) return
    if (spin) {
      spinRef.current += delta * spin
      ref.current.rotation.y = spinRef.current
    } else if (rotation) {
      ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, rotation.pitch, 0.15)
      ref.current.rotation.z = THREE.MathUtils.lerp(ref.current.rotation.z, rotation.roll, 0.15)
    }
    if (jitter > 0) {
      ref.current.position.x = position[0] + (Math.random() - 0.5) * jitter
      ref.current.position.y = position[1] + (Math.random() - 0.5) * jitter
    }
    if (matRef.current && alert) {
      matRef.current.emissiveIntensity = 0.25 + Math.sin(state.clock.elapsedTime * 5) * 0.25 + 0.25
    } else if (matRef.current) {
      matRef.current.emissiveIntensity = 0.08
    }
  })

  return (
    <mesh ref={ref} position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        ref={matRef}
        color={color}
        emissive={color}
        emissiveIntensity={0.08}
        roughness={0.4}
        metalness={0.1}
        wireframe={wireframe}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  )
}

function Scene({ variant, real, twin, severityColor, alert }) {
  const mobile = variant === 'mobile'
  const realTilt = mobile ? tiltFromAccel(real?.accel_x, real?.accel_y, real?.accel_z) : null
  const twinTilt = mobile ? tiltFromAccel(twin?.accel_x, twin?.accel_y, twin?.accel_z) : null

  const rpmReal = !mobile ? (real?.rpm ?? 0) : 0
  const rpmTwin = !mobile ? (twin?.rpm ?? 0) : 0
  const vibReal = !mobile ? (real?.vibration ?? 0) : 0
  const vibTwin = !mobile ? (twin?.vibration ?? 0) : 0

  const size = mobile ? [1, 2, 0.14] : [1.3, 1.3, 1.3]

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 6, 4]} intensity={1} castShadow />
      <directionalLight position={[-4, -2, -3]} intensity={0.25} />

      <group position={[-1.5, 0, 0]}>
        <DeviceBox
          position={[0, 0, 0]}
          size={size}
          color={severityColor}
          rotation={realTilt}
          spin={mobile ? 0 : rpmReal / 900}
          jitter={mobile ? 0 : Math.min(vibReal / 6, 1) * 0.08}
          alert={alert}
        />
      </group>

      <group position={[1.5, 0, 0]}>
        <DeviceBox
          position={[0, 0, 0]}
          size={size}
          color={TWIN_COLOR}
          rotation={twinTilt}
          spin={mobile ? 0 : rpmTwin / 900}
          jitter={mobile ? 0 : Math.min(vibTwin / 6, 1) * 0.08}
          wireframe
          opacity={0.55}
        />
      </group>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, mobile ? -1.15 : -0.85, 0]} receiveShadow>
        <planeGeometry args={[8, 5]} />
        <shadowMaterial opacity={0.06} />
      </mesh>

      <OrbitControls enablePan={false} minDistance={3.5} maxDistance={8} enableDamping dampingFactor={0.1} />
    </>
  )
}

export default function Twin3DScene({ variant = 'industrial', real, twin, severity, height = 320 }) {
  const color = SEVERITY_COLOR[severity] || SEVERITY_COLOR.HEALTHY
  const alert = !['HEALTHY', 'SYNCHRONIZED', 'LOW', 'NOT_CALIBRATED', undefined, null].includes(severity)

  return (
    <div>
      <div style={{ height }} className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-gradient-to-b from-[#fafbfc] to-[#f0f2f5]">
        <Canvas shadows camera={{ position: [0, 1.6, 6], fov: 40 }} dpr={[1, 1.5]}>
          <Suspense fallback={null}>
            <Scene variant={variant} real={real} twin={twin} severityColor={color} alert={alert} />
          </Suspense>
        </Canvas>
      </div>
      <div className="mt-3 flex items-center justify-center gap-8 text-xs">
        <span className="flex items-center gap-2 text-[var(--color-ink-dim)]">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
          Physical device
        </span>
        <span className="flex items-center gap-2 text-[var(--color-ink-dim)]">
          <span className="h-2.5 w-2.5 rounded-sm border-2" style={{ borderColor: TWIN_COLOR }} />
          Digital twin (expected state)
        </span>
      </div>
    </div>
  )
}
