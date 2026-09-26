import { Edges, Line } from '@react-three/drei'
import { useMemo, useState } from 'react'
import { casterPositions } from '../engine/parts'
import type { Cabinet, CabinetDims, Part, Tool, Vec3 } from '../engine/types'
import { COLORS, osbTextureFor } from './materials'
import { ToolModel } from './ToolModel'
import { useFloorDrag } from './useFloorDrag'

/** Where a part sits in the exploded view: pushed out from the carcass centre, tops lifted. */
function explodedCenter(p: Part, pivotY: number, factor: number): Vec3 {
  const [x, y, z] = p.center
  const lift = p.role === 'top' ? 180 : 0
  const ny = pivotY + (y - pivotY) * (1 + factor) + lift
  return [x * (1 + factor), Math.max(p.size[1] / 2, ny), z * (1 + factor)]
}

function PartMesh({ part, xray, position }: { part: Part; xray: boolean; position: Vec3 }) {
  const isOsb = part.material === 'osb'
  const map = useMemo(() => (isOsb ? osbTextureFor(part.size) : null), [isOsb, part.size])
  const panel = isOsb && (part.role === 'bottom' || part.role === 'side' || part.role === 'back' || part.role === 'top' || part.role === 'shelf')
  const ghost = xray && panel
  return (
    <mesh position={position} castShadow={!ghost} receiveShadow>
      <boxGeometry args={part.size} />
      {/* Keyed on ghost: three.js only recompiles `transparent` on a fresh material. */}
      <meshStandardMaterial
        key={ghost ? 'ghost' : 'solid'}
        map={map}
        color={isOsb ? '#ffffff' : COLORS.timber}
        roughness={0.85}
        transparent={ghost}
        opacity={ghost ? 0.16 : 1}
        depthWrite={!ghost}
      />
      <Edges threshold={20} color={isOsb ? COLORS.osbEdge : COLORS.timberEdge} transparent={ghost} opacity={ghost ? 0.45 : 1} />
    </mesh>
  )
}

/** Casters at the corners. */
function Casters({ dims }: { dims: CabinetDims }) {
  const h = dims.casterHeight
  if (h <= 0) return null
  const r = h * 0.36
  const plate = Math.min(80, dims.width / 2.5, dims.length / 2.5)
  return (
    <>
      {casterPositions(dims).map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, h - 4, 0]}>
            <boxGeometry args={[plate, 8, plate]} />
            <meshStandardMaterial color={COLORS.steel} metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[0, (h - 8 + r) / 2, 0]}>
            <boxGeometry args={[r * 0.9, h - 8 - r, r * 1.1]} />
            <meshStandardMaterial color={COLORS.steelDark} metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[0, r, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[r, r, r * 0.7, 24]} />
            <meshStandardMaterial color={COLORS.rubber} roughness={0.9} />
          </mesh>
        </group>
      ))}
    </>
  )
}

/** Slotted shim stacks under the tool's four corners. */
function ShimStacks({ tool, y, shim }: { tool: Tool; y: number; shim: number }) {
  const pad = 40
  return (
    <>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (tool.baseWidth / 2 - pad / 2 - 5), y + shim / 2, sz * (tool.baseLength / 2 - pad / 2 - 5)]}>
            <boxGeometry args={[pad, shim, pad]} />
            <meshStandardMaterial color={COLORS.shim} roughness={0.6} />
          </mesh>
        )),
      )}
    </>
  )
}

export interface DimSpec {
  from: Vec3
  to: Vec3
  label: string
  tick: Vec3
}

/**
 * Dimension lines for an object of footprint W × L and height H, in its local space:
 * width along the front, depth along the right side, height up the front-right corner.
 * The labels are drawn by the label layer at each line's midpoint.
 */
export function dimSpecs(W: number, L: number, H: number | null): DimSpec[] {
  const off = 120
  const specs: DimSpec[] = [
    { from: [-W / 2, 2, L / 2 + off], to: [W / 2, 2, L / 2 + off], label: `${Math.round(W)}`, tick: [0, 0, 30] },
    { from: [W / 2 + off, 2, -L / 2], to: [W / 2 + off, 2, L / 2], label: `${Math.round(L)}`, tick: [30, 0, 0] },
  ]
  if (H !== null) specs.push({ from: [W / 2 + off, 0, L / 2 + off], to: [W / 2 + off, H, L / 2 + off], label: `${Math.round(H)}`, tick: [30, 0, 0] })
  return specs
}

export const midpoint = (d: DimSpec): Vec3 => [(d.from[0] + d.to[0]) / 2, (d.from[1] + d.to[1]) / 2, (d.from[2] + d.to[2]) / 2]

export function DimensionLines({ specs }: { specs: DimSpec[] }) {
  const t = (p: Vec3, tick: Vec3, s: number): Vec3 => [p[0] + tick[0] * s, p[1] + tick[1] * s, p[2] + tick[2] * s]
  return (
    <group>
      {specs.map((d, i) => (
        <group key={i}>
          <Line points={[d.from, d.to]} color={COLORS.ink} lineWidth={1.5} />
          <Line points={[t(d.from, d.tick, -1), t(d.from, d.tick, 1)]} color={COLORS.ink} lineWidth={1.5} />
          <Line points={[t(d.to, d.tick, -1), t(d.to, d.tick, 1)]} color={COLORS.ink} lineWidth={1.5} />
        </group>
      ))}
    </group>
  )
}

/** Height of the label above a cabinet's floor point: over the tool, or over the top. */
export function cabinetLabelHeight(dims: CabinetDims, tool: Tool | undefined, exploded: boolean): number {
  const topY = Math.max(dims.surfaceHeight, 10)
  return topY + dims.shim + (tool ? tool.overallHeight : 0) + (exploded ? 420 : 0) + 120
}

export function CabinetObject(props: {
  cab: Cabinet
  dims: CabinetDims
  parts: Part[]
  tool: Tool | undefined
  selected: boolean
  xray: boolean
  explode: boolean
}) {
  const { cab, dims, parts, tool, selected, xray, explode } = props
  const drag = useFloorDrag('cabinet', cab.id)
  const [hover, setHover] = useState(false)
  const pivotY = dims.casterHeight + dims.carcassHeight / 2
  const factor = selected && explode ? 0.7 : 0
  const toolLift = factor ? 420 : 0
  const valid = parts.length > 0
  const W = dims.width
  const L = dims.length
  const topY = valid ? dims.surfaceHeight : Math.max(dims.surfaceHeight, 10)
  const labelY = cabinetLabelHeight(dims, tool, !!factor)

  return (
    <group
      position={[cab.x, 0, cab.z]}
      rotation={[0, (-cab.rotation * Math.PI) / 180, 0]}
      {...drag}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
        document.body.style.cursor = 'grab'
      }}
      onPointerOut={() => {
        setHover(false)
        document.body.style.cursor = ''
      }}
    >
      <Casters dims={dims} />
      {valid ? (
        parts.map((p) => (
          <PartMesh key={p.id} part={p} xray={selected && xray} position={factor ? explodedCenter(p, pivotY, factor) : p.center} />
        ))
      ) : (
        // A cabinet the engine can't build: show its envelope in red.
        <mesh position={[0, Math.max(dims.surfaceHeight, 10) / 2, 0]}>
          <boxGeometry args={[W, Math.max(dims.surfaceHeight, 10), L]} />
          <meshStandardMaterial color={COLORS.red} transparent opacity={0.25} />
        </mesh>
      )}
      {tool && (
        <>
          {dims.shim > 0 && <ShimStacks tool={tool} y={topY + toolLift} shim={dims.shim} />}
          <group position={[0, topY + toolLift + dims.shim, 0]}>
            <ToolModel tool={tool} />
          </group>
        </>
      )}
      {(selected || hover) && (
        <mesh position={[0, labelY / 2 - 60, 0]}>
          <boxGeometry args={[W + 30, labelY - 120 + 10, L + 30]} />
          <meshBasicMaterial visible={false} />
          <Edges color={selected ? COLORS.tape : COLORS.ink} lineWidth={selected ? 2.5 : 1} />
        </mesh>
      )}
      {selected && !factor && <DimensionLines specs={dimSpecs(W, L, topY)} />}
    </group>
  )
}
