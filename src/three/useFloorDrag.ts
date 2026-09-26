import type { ThreeEvent } from '@react-three/fiber'
import { useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { planStore } from '../store'

const SNAP = 10
const snap = (v: number) => Math.round(v / SNAP) * SNAP

type Controls = { enabled: boolean } | null

/**
 * Click to select, drag to slide an object across the floor (10 mm snap).
 * The pointer ray is intersected with the floor plane, and the grab offset is kept so the
 * object doesn't jump to the cursor. Orbit controls are disabled for the drag's duration —
 * r3f's canvas listener runs before OrbitControls', so disabling on pointerdown wins.
 */
export function useFloorDrag(kind: 'cabinet' | 'fixture', id: string) {
  const controls = useThree((s) => s.controls) as unknown as Controls
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const drag = useRef<{ dx: number; dz: number; sx: number; sy: number; moved: boolean } | null>(null)
  const hit = useMemo(() => new THREE.Vector3(), [])

  const position = () => {
    const st = planStore.getState()
    const o = kind === 'cabinet' ? st.cabinets.find((c) => c.id === id) : st.fixtures.find((f) => f.id === id)
    return o ? { x: o.x, z: o.z } : { x: 0, z: 0 }
  }

  return {
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      if (e.button !== 0) return
      e.stopPropagation()
      planStore.getState().select({ kind, id })
      if (!e.ray.intersectPlane(plane, hit)) return
      const p = position()
      drag.current = { dx: p.x - hit.x, dz: p.z - hit.z, sx: e.clientX, sy: e.clientY, moved: false }
      ;(e.target as unknown as Element).setPointerCapture(e.pointerId)
      if (controls) controls.enabled = false
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      const d = drag.current
      if (!d) return
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return
      d.moved = true
      if (!e.ray.intersectPlane(plane, hit)) return
      const x = snap(hit.x + d.dx)
      const z = snap(hit.z + d.dz)
      const p = position()
      if (x !== p.x || z !== p.z) planStore.getState().move(kind, id, x, z)
    },
    onPointerUp: (e: ThreeEvent<PointerEvent>) => {
      if (!drag.current) return
      drag.current = null
      ;(e.target as unknown as Element).releasePointerCapture?.(e.pointerId)
      if (controls) controls.enabled = true
    },
  }
}
