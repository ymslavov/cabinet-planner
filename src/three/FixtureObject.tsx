import { Edges } from '@react-three/drei'
import { useState } from 'react'
import type { Fixture } from '../engine/types'
import { DimensionLines, dimSpecs } from './CabinetObject'
import { COLORS } from './materials'
import { useFloorDrag } from './useFloorDrag'

/**
 * Existing furniture (the outfeed cabinets). Drawn plainer than the cabinets we build —
 * a grey box with a lighter top and wheels — and dashed-looking when not yet measured.
 */
export function FixtureObject({ fx, selected }: { fx: Fixture; selected: boolean }) {
  const drag = useFloorDrag('fixture', fx.id)
  const [hover, setHover] = useState(false)
  const { width: W, length: L, height: H } = fx
  const wheel = Math.min(80, H / 6)
  const topT = 25
  return (
    <group
      position={[fx.x, 0, fx.z]}
      rotation={[0, (-fx.rotation * Math.PI) / 180, 0]}
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
      <mesh position={[0, wheel + (H - wheel - topT) / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W - 20, H - wheel - topT, L - 20]} />
        <meshStandardMaterial color="#9aa3a8" roughness={0.8} transparent={!fx.measured} opacity={fx.measured ? 1 : 0.75} />
        <Edges color="#5d666c" />
      </mesh>
      <mesh position={[0, H - topT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, topT, L]} />
        <meshStandardMaterial color="#d4d8d4" roughness={0.7} />
        <Edges color="#5d666c" />
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (W / 2 - 60), wheel / 2, sz * (L / 2 - 60)]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[wheel / 2, wheel / 2, wheel * 0.6, 20]} />
            <meshStandardMaterial color={COLORS.rubber} />
          </mesh>
        )),
      )}
      {(selected || hover) && (
        <mesh position={[0, H / 2 + 5, 0]}>
          <boxGeometry args={[W + 30, H + 10, L + 30]} />
          <meshBasicMaterial visible={false} />
          <Edges color={selected ? COLORS.tape : COLORS.ink} />
        </mesh>
      )}
      {selected && <DimensionLines specs={dimSpecs(W, L, null)} />}
    </group>
  )
}
