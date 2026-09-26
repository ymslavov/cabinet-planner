import { Grid, OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { Derived } from '../engine/analyze'
import { feedStrip, footprints } from '../engine/checks'
import { cabinetLetter } from '../engine/cutlist'
import { planStore, usePlan } from '../store'
import { cabinetLabelHeight, CabinetObject, dimSpecs, midpoint } from './CabinetObject'
import { FixtureObject } from './FixtureObject'
import { LabelLayer, LabelProjector, toWorld, type SceneLabel } from './labels'
import { COLORS } from './materials'

type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number }

function useBounds(derived: Derived): Bounds {
  const settings = usePlan((s) => s.settings)
  const tools = usePlan((s) => s.tools)
  const cabinets = usePlan((s) => s.cabinets)
  const fixtures = usePlan((s) => s.fixtures)
  return useMemo(() => {
    const fps = footprints({ settings, tools, cabinets, fixtures }, derived.dims)
    if (fps.length === 0) return { minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000 }
    return {
      minX: Math.min(...fps.map((f) => f.x - f.sx / 2)),
      maxX: Math.max(...fps.map((f) => f.x + f.sx / 2)),
      minZ: Math.min(...fps.map((f) => f.z - f.sz / 2)),
      maxZ: Math.max(...fps.map((f) => f.z + f.sz / 2)),
    }
  }, [settings, tools, cabinets, fixtures, derived.dims])
}

/** Moves the camera when the view mode or the "fit" request changes. */
function CameraRig({ bounds, topView, fitNonce }: { bounds: Bounds; topView: boolean; fitNonce: number }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as { target: { set: (x: number, y: number, z: number) => void }; update: () => void } | null
  useEffect(() => {
    if (!controls) return
    const cx = (bounds.minX + bounds.maxX) / 2
    const cz = (bounds.minZ + bounds.maxZ) / 2
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ, 2000)
    // Distance that fits `span` in a 38° vertical field of view, with room for labels.
    const dist = span * 1.45 + 1200
    if (topView) {
      camera.position.set(cx, dist, cz + 1)
      controls.target.set(cx, 0, cz)
    } else {
      const dir = [0.3, 0.62, 0.72]
      const n = Math.hypot(...dir)
      camera.position.set(cx + (dir[0] / n) * dist, 450 + (dir[1] / n) * dist, cz + (dir[2] / n) * dist)
      controls.target.set(cx, 450, cz)
    }
    controls.update()
    // Only re-aim on explicit requests, not whenever bounds change during a drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topView, fitNonce, controls])
  return null
}

function WorkPlane({ bounds, height }: { bounds: Bounds; height: number }) {
  const pad = 600
  const w = bounds.maxX - bounds.minX + 2 * pad
  const l = bounds.maxZ - bounds.minZ + 2 * pad
  return (
    <mesh position={[(bounds.minX + bounds.maxX) / 2, height, (bounds.minZ + bounds.maxZ) / 2]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <planeGeometry args={[w, l]} />
      <meshBasicMaterial color={COLORS.tape} transparent opacity={0.1} depthWrite={false} side={2} />
    </mesh>
  )
}

function FeedStrips({ derived }: { derived: Derived }) {
  const cabinets = usePlan((s) => s.cabinets)
  const tools = usePlan((s) => s.tools)
  const feedLength = usePlan((s) => s.settings.feedLength)
  const blocked = new Set(derived.warnings.filter((w) => w.code === 'feed-blocked').map((w) => w.objectId))
  return (
    <>
      {cabinets.map((c) => {
        const tool = tools.find((t) => t.id === c.toolId)
        const d = derived.dims[c.id]
        if (!tool || d.carcassHeight <= 0) return null
        const strip = feedStrip(c, tool, d, feedLength)
        if (!strip) return null
        const color = blocked.has(c.id) ? COLORS.red : COLORS.feed
        return (
          <mesh key={c.id} position={[strip.x, strip.top + 1, strip.z]} raycast={() => null}>
            <boxGeometry args={[strip.sx, 2, strip.sz]} />
            <meshBasicMaterial color={color} transparent opacity={0.16} depthWrite={false} />
          </mesh>
        )
      })}
    </>
  )
}

function Room() {
  const room = usePlan((s) => s.settings.room)
  if (!room.enabled) return null
  const h = 300
  const t = 80
  const walls: [number, number, number, number][] = [
    [0, -room.length / 2 - t / 2, room.width + 2 * t, t],
    [0, room.length / 2 + t / 2, room.width + 2 * t, t],
    [-room.width / 2 - t / 2, 0, t, room.length],
    [room.width / 2 + t / 2, 0, t, room.length],
  ]
  return (
    <>
      {walls.map(([x, z, w, l], i) => (
        <mesh key={i} position={[x, h / 2, z]} raycast={() => null} receiveShadow>
          <boxGeometry args={[w, h, l]} />
          <meshStandardMaterial color="#b9bfbb" />
        </mesh>
      ))}
    </>
  )
}

function Toolbar({ onFit }: { onFit: () => void }) {
  const view = usePlan((s) => s.view)
  const selection = usePlan((s) => s.selection)
  const setView = planStore.getState().setView
  const cabSelected = selection?.kind === 'cabinet'
  const toggle = (key: 'topView' | 'xray' | 'explode' | 'showPlane' | 'showFeed', label: string, disabled = false, title?: string) => (
    <button className="btn small" aria-pressed={view[key]} disabled={disabled} title={title} onClick={() => setView({ [key]: !view[key] })}>
      {label}
    </button>
  )
  return (
    <div className="scene-toolbar">
      <div className="group">
        {toggle('topView', 'Top view')}
        <button className="btn small" onClick={onFit}>
          Fit all
        </button>
      </div>
      <div className="group">
        {toggle('xray', 'X-ray', !cabSelected, 'See the framing inside the selected cabinet')}
        {toggle('explode', 'Exploded', !cabSelected, 'Pull the selected cabinet apart')}
      </div>
      <div className="group">
        {toggle('showPlane', 'Work plane')}
        {toggle('showFeed', 'Feed paths')}
      </div>
    </div>
  )
}

export default function LayoutView({ derived }: { derived: Derived }) {
  const cabinets = usePlan((s) => s.cabinets)
  const fixtures = usePlan((s) => s.fixtures)
  const tools = usePlan((s) => s.tools)
  const selection = usePlan((s) => s.selection)
  const view = usePlan((s) => s.view)
  const targetHeight = usePlan((s) => s.settings.targetHeight)
  const rodSize = usePlan((s) => s.settings.leveler.rod)
  const bounds = useBounds(derived)
  const fitNonce = usePlan((s) => s.fitNonce)
  const selId = selection && 'id' in selection ? selection.id : null
  const labelEls = useRef(new Map<string, HTMLDivElement>())

  const labels = useMemo(() => {
    const out: SceneLabel[] = []
    cabinets.forEach((c, i) => {
      const d = derived.dims[c.id]
      const tool = tools.find((t) => t.id === c.toolId)
      const selected = selId === c.id
      const exploded = selected && view.explode
      out.push({
        key: `cab:${c.id}`,
        pos: toWorld(c.x, c.z, c.rotation, [0, cabinetLabelHeight(d, tool, exploded), 0]),
        className: `obj-label${selected ? ' selected' : ''}`,
        content: (
          <>
            <b>{cabinetLetter(i)}</b>
            {selected && <span>{c.name}</span>}
          </>
        ),
      })
      if (selected && !exploded) {
        dimSpecs(d.width, d.length, Math.max(d.surfaceHeight, 10)).forEach((spec, k) =>
          out.push({ key: `dim:${c.id}:${k}`, pos: toWorld(c.x, c.z, c.rotation, midpoint(spec)), className: 'dim-label', content: spec.label }),
        )
      }
    })
    for (const f of fixtures) {
      const selected = selId === f.id
      out.push({
        key: `fx:${f.id}`,
        pos: [f.x, f.height + 120, f.z],
        className: `obj-label fixture${selected ? ' selected' : ''}`,
        content: (
          <>
            <span>{f.name}</span>
            {!f.measured && <em>measure</em>}
          </>
        ),
      })
      if (selected) {
        dimSpecs(f.width, f.length, null).forEach((spec, k) =>
          out.push({ key: `dim:${f.id}:${k}`, pos: toWorld(f.x, f.z, f.rotation, midpoint(spec)), className: 'dim-label', content: spec.label }),
        )
      }
    }
    return out
  }, [cabinets, fixtures, tools, derived.dims, selId, view.explode])

  return (
    <div className="scene">
      <Canvas
        shadows="percentage"
        dpr={[1, 2]}
        camera={{ position: [3000, 3500, 5500], fov: 38, near: 20, far: 80000 }}
        onPointerMissed={(e) => e.button === 0 && planStore.getState().select(null)}
      >
        <color attach="background" args={[COLORS.ground]} />
        <hemisphereLight args={['#ffffff', '#b8b2a6', 1.1]} />
        <directionalLight
          position={[2500, 6000, 3500]}
          intensity={1.9}
          castShadow
          shadow-mapSize={[4096, 4096]}
          shadow-camera-left={-6000}
          shadow-camera-right={6000}
          shadow-camera-top={6000}
          shadow-camera-bottom={-6000}
          shadow-camera-near={100}
          shadow-camera-far={20000}
          shadow-bias={-0.0004}
        />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow raycast={() => null}>
          <planeGeometry args={[60000, 60000]} />
          <meshStandardMaterial color={COLORS.floor} roughness={1} />
        </mesh>
        <Grid
          position={[0, 0.5, 0]}
          args={[40000, 40000]}
          cellSize={100}
          cellThickness={0.6}
          cellColor="#c3c9c4"
          sectionSize={1000}
          sectionThickness={1.1}
          sectionColor="#9aa39d"
          fadeDistance={22000}
          fadeStrength={1.5}
          infiniteGrid
        />
        <Room />
        {cabinets.map((c) => (
          <CabinetObject
            key={c.id}
            cab={c}
            dims={derived.dims[c.id]}
            parts={derived.parts[c.id] ?? []}
            tool={tools.find((t) => t.id === c.toolId)}
            selected={selId === c.id}
            xray={view.xray}
            explode={view.explode}
            rodSize={rodSize}
          />
        ))}
        {fixtures.map((f) => (
          <FixtureObject key={f.id} fx={f} selected={selId === f.id} />
        ))}
        {view.showPlane && <WorkPlane bounds={bounds} height={targetHeight} />}
        {view.showFeed && <FeedStrips derived={derived} />}
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.03} minDistance={400} maxDistance={30000} />
        <CameraRig bounds={bounds} topView={view.topView} fitNonce={fitNonce} />
        <LabelProjector labels={labels} els={labelEls} />
      </Canvas>
      <LabelLayer labels={labels} els={labelEls} />
      <Toolbar onFit={() => planStore.getState().requestFit()} />
      <div className="scene-legend">
        <span>
          <i style={{ background: COLORS.osb }} /> OSB
        </span>
        <span>
          <i style={{ background: COLORS.timber }} /> Timber
        </span>
        {view.showPlane && (
          <span>
            <i style={{ background: COLORS.tape, opacity: 0.5 }} /> {targetHeight} mm plane
          </span>
        )}
        {view.showFeed && (
          <span>
            <i style={{ background: COLORS.feed, opacity: 0.5 }} /> Feed path (red when blocked)
          </span>
        )}
        <span className="muted">Drag to move, R to turn, right-drag to pan</span>
      </div>
    </div>
  )
}
