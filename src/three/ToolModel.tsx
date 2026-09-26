import type { ReactNode } from 'react'
import type { Tool } from '../engine/types'
import { COLORS } from './materials'

/**
 * Simplified but recognisable tool models, built from primitives at the tool's real
 * footprint (baseWidth × baseLength), deck height and overall height. Origin = centre of the
 * tool's base, resting on the cabinet top. Front = +Z.
 */

function Box(props: { size: [number, number, number]; at: [number, number, number]; color: string; opacity?: number; metal?: boolean }) {
  const { size, at, color, opacity, metal } = props
  return (
    <mesh position={at} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={metal ? 0.35 : 0.6}
        metalness={metal ? 0.55 : 0.05}
        transparent={opacity !== undefined}
        opacity={opacity ?? 1}
        depthWrite={opacity === undefined}
      />
    </mesh>
  )
}

/** A disc (blade, sanding disc, turntable) whose axis lies along `axis`. */
function Disc(props: { r: number; t: number; at: [number, number, number]; axis: 'x' | 'y' | 'z'; color: string; metal?: boolean; opacity?: number }) {
  const { r, t, at, axis, color, metal, opacity } = props
  const rotation: [number, number, number] = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0]
  return (
    <mesh position={at} rotation={rotation} castShadow>
      <cylinderGeometry args={[r, r, t, 48]} />
      <meshStandardMaterial
        color={color}
        roughness={metal ? 0.25 : 0.6}
        metalness={metal ? 0.7 : 0.05}
        transparent={opacity !== undefined}
        opacity={opacity ?? 1}
      />
    </mesh>
  )
}

function TableSaw({ tool }: { tool: Tool }) {
  const { baseWidth: W, baseLength: L, deckHeight: D, color } = tool
  const tableT = 25
  const bladeR = 127
  const bladeX = -W * 0.08
  return (
    <>
      <Box size={[W * 0.82, D - tableT, L * 0.82]} at={[0, (D - tableT) / 2, 0]} color={color} />
      <Box size={[W, tableT, L]} at={[0, D - tableT / 2, 0]} color={COLORS.steel} metal />
      {/* Blade: 254 mm, ~80 mm above the table */}
      <Disc r={bladeR} t={3} at={[bladeX, D - bladeR + 80, 0]} axis="x" color="#d7dbde" metal />
      {/* Guard */}
      <Box size={[70, 95, 300]} at={[bladeX, D + 95 / 2 + 20, 0]} color="#9aa7b1" opacity={0.45} />
      {/* Rip fence and front rail */}
      <Box size={[45, 60, L]} at={[W * 0.28, D + 30, 0]} color={COLORS.rubber} />
      <Box size={[W, 40, 40]} at={[0, D - tableT - 25, L / 2 + 5]} color={COLORS.steelDark} metal />
    </>
  )
}

function Thicknesser({ tool }: { tool: Tool }) {
  const { baseWidth: W, baseLength: L, deckHeight: D, overallHeight: H, color } = tool
  const headH = 130
  return (
    <>
      <Box size={[W * 0.9, D - 10, L * 0.7]} at={[0, (D - 10) / 2, 0]} color={color} />
      {/* Bed with infeed/outfeed tables */}
      <Box size={[W * 0.66, 10, L]} at={[0, D - 5, 0]} color={COLORS.steel} metal />
      {/* Columns and the cutter head carriage */}
      {[-1, 1].map((s) => (
        <Box key={s} size={[55, H - D, L * 0.45]} at={[s * (W / 2 - 40), D + (H - D) / 2, 0]} color={color} />
      ))}
      <Box size={[W, headH, L * 0.55]} at={[0, H - headH / 2 - 40, 0]} color={color} />
      <Disc r={45} t={30} at={[0, H - 15, 0]} axis="y" color={COLORS.rubber} />
      {/* Crank handle */}
      <Box size={[12, 50, 12]} at={[40, H + 10, 0]} color={COLORS.rubber} />
    </>
  )
}

function Sander({ tool }: { tool: Tool }) {
  const { baseWidth: W, baseLength: L, deckHeight: D, overallHeight: H, color } = tool
  const beltLen = W * 0.75
  return (
    <>
      <Box size={[W * 0.85, D * 0.9, L * 0.85]} at={[0, (D * 0.9) / 2, 0]} color={color} />
      {/* 150 mm disc on the left, with its work table at the deck */}
      <Disc r={75} t={18} at={[-W / 2 + 12, D - 40, L * 0.15]} axis="x" color="#8a6b47" />
      <Box size={[W * 0.22, 10, L * 0.45]} at={[-W / 2 + W * 0.11, D - 5, L * 0.18]} color={COLORS.steel} metal />
      {/* Horizontal belt unit on top */}
      <Box size={[beltLen, H - D, 110]} at={[W * 0.08, D + (H - D) / 2, -L * 0.15]} color={COLORS.steelDark} metal />
      <Box size={[beltLen - 40, 6, 100]} at={[W * 0.08, H + 3, -L * 0.15]} color="#7a5c3e" />
      <Box size={[W * 0.4, 10, 110]} at={[W * 0.1, D - 5, L * 0.18]} color={COLORS.steel} metal />
    </>
  )
}

function MitreSaw({ tool }: { tool: Tool }) {
  const { baseWidth: W, baseLength: L, deckHeight: D, overallHeight: H, color } = tool
  const r = Math.min(W, L) * 0.34
  const bladeR = 108
  const headY = H - 150
  return (
    <>
      <Box size={[W, D - 15, L * 0.75]} at={[0, (D - 15) / 2, -L * 0.1]} color={COLORS.steelDark} metal />
      <Disc r={r} t={15} at={[0, D - 7.5, 0]} axis="y" color={COLORS.steel} metal />
      {/* Fence, split at the blade */}
      {[-1, 1].map((s) => (
        <Box key={s} size={[W / 2 - 25, 85, 22]} at={[s * (W / 4 + 12), D + 42, -r * 0.55]} color={COLORS.steel} metal />
      ))}
      {/* Axial-Glide arm at the back, head over the turntable */}
      <Box size={[70, headY - D, 70]} at={[0, D + (headY - D) / 2, -L / 2 + 45]} color={COLORS.steelDark} metal />
      <Box size={[70, 70, L * 0.7]} at={[0, headY, -L * 0.12]} color={COLORS.steelDark} metal />
      <Box size={[150, 150, 230]} at={[70, headY + 20, L * 0.08]} color={color} />
      <Disc r={bladeR} t={3} at={[0, headY - 40, L * 0.08]} axis="x" color="#d7dbde" metal />
      <Disc r={bladeR + 12} t={50} at={[0, headY - 40, L * 0.08]} axis="x" color="#9aa7b1" opacity={0.35} />
      <Box size={[40, 40, 140]} at={[0, headY + 60, L * 0.3]} color={COLORS.rubber} />
    </>
  )
}

function DrillPress({ tool }: { tool: Tool }) {
  const { baseWidth: W, baseLength: L, deckHeight: D, overallHeight: H, color } = tool
  const colZ = -L / 2 + 75
  const headH = 210
  const spindleZ = L * 0.08
  return (
    <>
      <Box size={[W, 30, L]} at={[0, 15, 0]} color={COLORS.steelDark} metal />
      <mesh position={[0, 30 + (H - 30 - headH / 2) / 2, colZ]} castShadow>
        <cylinderGeometry args={[30, 30, H - 30 - headH / 2, 24]} />
        <meshStandardMaterial color={COLORS.steel} metalness={0.7} roughness={0.25} />
      </mesh>
      {/* Adjustable table at deck height, on an arm from the column */}
      <Disc r={Math.min(W, L) * 0.36} t={18} at={[0, D, spindleZ]} axis="y" color={COLORS.steelDark} metal />
      <Box size={[60, 40, spindleZ - colZ]} at={[0, D - 25, (spindleZ + colZ) / 2]} color={COLORS.steelDark} metal />
      <Box size={[170, headH, 300]} at={[0, H - headH / 2, colZ + 110]} color={color} />
      <mesh position={[0, H - headH - 40, spindleZ]} castShadow>
        <cylinderGeometry args={[18, 14, 80, 16]} />
        <meshStandardMaterial color={COLORS.steel} metalness={0.7} roughness={0.25} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[110, H - headH / 2, colZ + 110]} rotation={[(i * 2 * Math.PI) / 3, 0, 0]}>
          <cylinderGeometry args={[6, 6, 180, 8]} />
          <meshStandardMaterial color={COLORS.rubber} />
        </mesh>
      ))}
    </>
  )
}

function Generic({ tool }: { tool: Tool }) {
  const { baseWidth: W, baseLength: L, deckHeight: D, overallHeight: H, color } = tool
  return (
    <>
      <Box size={[W, D, L]} at={[0, D / 2, 0]} color={color} />
      {H > D && <Box size={[W * 0.6, H - D, L * 0.6]} at={[0, D + (H - D) / 2, 0]} color={color} opacity={0.6} />}
    </>
  )
}

export function ToolModel({ tool }: { tool: Tool }) {
  let body: ReactNode
  switch (tool.shape) {
    case 'tableSaw':
      body = <TableSaw tool={tool} />
      break
    case 'thicknesser':
      body = <Thicknesser tool={tool} />
      break
    case 'sander':
      body = <Sander tool={tool} />
      break
    case 'mitreSaw':
      body = <MitreSaw tool={tool} />
      break
    case 'drillPress':
      body = <DrillPress tool={tool} />
      break
    default:
      body = <Generic tool={tool} />
  }
  return <group>{body}</group>
}
