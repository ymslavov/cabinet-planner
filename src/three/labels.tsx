import { useFrame } from '@react-three/fiber'
import type { ReactNode, RefObject } from 'react'
import * as THREE from 'three'
import type { Rotation, Vec3 } from '../engine/types'

/**
 * Screen-space labels for the 3D view.
 *
 * drei's <Html> creates one React root per label and unmounts it synchronously inside the
 * commit phase, which React 19 reports as a race ("Attempted to synchronously unmount a
 * root…") and which dropped labels. Instead, the labels are plain DOM in a layer over the
 * canvas, and one useFrame projects their world positions every frame.
 */
export interface SceneLabel {
  key: string
  pos: Vec3
  className: string
  content: ReactNode
}

const Y = new THREE.Vector3(0, 1, 0)

/** An object-local point (object at x/z, turned by `rotation` degrees) in world space. */
export function toWorld(x: number, z: number, rotation: Rotation, local: Vec3): Vec3 {
  const v = new THREE.Vector3(...local).applyAxisAngle(Y, (-rotation * Math.PI) / 180)
  return [v.x + x, v.y, v.z + z]
}

const tmp = new THREE.Vector3()

export function LabelProjector({ labels, els }: { labels: SceneLabel[]; els: RefObject<Map<string, HTMLDivElement>> }) {
  useFrame(({ camera, size }) => {
    for (const l of labels) {
      const el = els.current?.get(l.key)
      if (!el) continue
      tmp.set(l.pos[0], l.pos[1], l.pos[2]).project(camera)
      const visible = tmp.z < 1 && Math.abs(tmp.x) < 1.2 && Math.abs(tmp.y) < 1.2
      el.style.visibility = visible ? 'visible' : 'hidden'
      if (!visible) continue
      const x = ((tmp.x + 1) / 2) * size.width
      const y = ((1 - tmp.y) / 2) * size.height
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`
    }
  })
  return null
}

export function LabelLayer({ labels, els }: { labels: SceneLabel[]; els: RefObject<Map<string, HTMLDivElement>> }) {
  return (
    <div className="label-layer" aria-hidden>
      {labels.map((l) => (
        <div
          key={l.key}
          className={`scene-label ${l.className}`}
          ref={(el) => {
            if (el) els.current?.set(l.key, el)
            else els.current?.delete(l.key)
          }}
        >
          {l.content}
        </div>
      ))}
    </div>
  )
}
