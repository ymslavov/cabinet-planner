import type { BuildMethod, Cabinet, CabinetDims, Part, PartRole, Settings, Vec3 } from './types'

/**
 * Cleat cross-section for a build method.
 * ca = the thin side (faces into the box), cb = the wide side (along the panel it is screwed to).
 * Laminated OSB cleats are `laminations` strips of t × width glued face to face.
 */
export function framing(s: Settings, method: BuildMethod): { ca: number; cb: number; material: 'osb' | 'timber' } {
  if (method === 'osb-cleat') {
    return { ca: s.osbCleat.laminations * s.sheet.thickness, cb: s.osbCleat.width, material: 'osb' }
  }
  return { ca: s.timber.a, cb: s.timber.b, material: 'timber' }
}

/** Valid range for a shelf's top-face height above the inside floor. */
export function shelfRange(dims: CabinetDims, s: Settings, method: BuildMethod): [number, number] {
  const { cb } = framing(s, method)
  const innerH = dims.carcassHeight - dims.t
  // Its support rail must clear the bottom rail, and the shelf must clear the top rail.
  return [dims.t + 2 * cb, innerH - cb]
}

type Box = [number, number, number, number, number, number] // x0 x1 y0 y1 z0 z1

/** Distance from each cabinet edge to a caster's centre (plates ~80 mm square). */
function casterInset(d: CabinetDims): number {
  return Math.min(45, d.width / 4, d.length / 4)
}

/** Caster centres in cabinet space (x, z), one near each corner. */
export function casterPositions(d: CabinetDims): [number, number][] {
  const ci = casterInset(d)
  return [
    [-(d.width / 2 - ci), -(d.length / 2 - ci)],
    [d.width / 2 - ci, -(d.length / 2 - ci)],
    [-(d.width / 2 - ci), d.length / 2 - ci],
    [d.width / 2 - ci, d.length / 2 - ci],
  ]
}

/**
 * Every physical part of an open-front box on casters, in cabinet space
 * (origin = footprint centre at floor level, +Z = front).
 *
 * Panels (all methods): bottom W×L that the casters bolt through; back W wide standing on
 * the bottom behind the sides; sides between back and front edge; `topLayers` top layers;
 * shelves resting on side rails. Every OSB cut stays a straight rip/crosscut: shelves stop
 * in front of the rear corner cleats (and behind front posts) instead of being notched.
 *
 * Framing at every panel joint: rear corner verticals, side rails top and bottom, back
 * rails top and bottom, a shelf-support rail on each side under every shelf.
 * timber-frame adds front posts and front top/bottom rails to stiffen the open face, and
 * keeps the rear framing even without a back panel.
 */
export function cabinetParts(cab: Cabinet, dims: CabinetDims, s: Settings): Part[] {
  const { width: W, length: L, t, casterHeight: y0, carcassHeight: H } = dims
  const { ca, cb, material: cleatMaterial } = framing(s, cab.method)
  const innerH = H - t
  const frame = cab.method === 'timber-frame'
  const rearFraming = cab.hasBack || frame
  const yFloor = y0 + t
  const yTopUnder = y0 + H
  const zBack = cab.hasBack ? -L / 2 + t : -L / 2 // inside face of the back (or the rear edge)
  const zRear = zBack + (rearFraming ? ca : 0) // where side rails and shelves start
  const zFront = L / 2 - (frame ? ca : 0) // where side rails and shelves end
  const xIn = W / 2 - t // inside face of the sides
  // Guard on the real spans: only timber-frame has framing at the front.
  if (H <= 0 || innerH < 2 * cb + 1 || 2 * xIn - 2 * cb <= 0 || zFront - zRear <= 0) return []

  const parts: Part[] = []
  const add = (key: string, label: string, role: PartRole, box: Box, material: 'osb' | 'timber' = 'osb', cut?: Part['cut']) => {
    const [x0, x1, y0b, y1, z0, z1] = box
    const size: Vec3 = [x1 - x0, y1 - y0b, z1 - z0]
    const center: Vec3 = [(x0 + x1) / 2, (y0b + y1) / 2, (z0 + z1) / 2]
    const grainLocked = s.respectGrain && (role === 'top' || role === 'shelf')
    parts.push({
      id: `${cab.id}:${key}`,
      cabinetId: cab.id,
      label,
      role,
      material,
      size,
      center,
      cut: cut ?? cutFor(role, material, size, grainLocked, s),
      grainLocked,
    })
  }
  const cleat = (key: string, label: string, role: PartRole, box: Box) =>
    add(key, label, role, box, role === 'cleat' ? cleatMaterial : 'timber')

  // Panels
  add('bottom', 'Bottom', 'bottom', [-W / 2, W / 2, y0, yFloor, -L / 2, L / 2])
  if (cab.hasBack) add('back', 'Back', 'back', [-W / 2, W / 2, yFloor, yTopUnder, -L / 2, zBack])
  add('side-l', 'Side left', 'side', [-W / 2, -xIn, yFloor, yTopUnder, zBack, L / 2])
  add('side-r', 'Side right', 'side', [xIn, W / 2, yFloor, yTopUnder, zBack, L / 2])
  for (let i = 0; i < s.topLayers; i++) {
    add(`top-${i + 1}`, `Top layer ${i + 1}`, 'top', [-W / 2, W / 2, yTopUnder + i * t, yTopUnder + (i + 1) * t, -L / 2, L / 2])
  }

  // Rear corner verticals + back rails (between the verticals)
  if (rearFraming) {
    for (const [side, sx] of [['l', -1], ['r', 1]] as const) {
      const xa = sx * xIn
      const xb = sx * (xIn - cb)
      cleat(`rear-post-${side}`, `Rear corner ${side === 'l' ? 'left' : 'right'}`, frame ? 'post' : 'cleat', [
        Math.min(xa, xb), Math.max(xa, xb), yFloor, yTopUnder, zBack, zBack + ca,
      ])
    }
    const backSpan: [number, number] = [-xIn + cb, xIn - cb]
    cleat('back-rail-bottom', 'Back rail bottom', frame ? 'rail' : 'cleat', [...backSpan, yFloor, yFloor + cb, zBack, zBack + ca])
    cleat('back-rail-top', 'Back rail top', frame ? 'rail' : 'cleat', [...backSpan, yTopUnder - cb, yTopUnder, zBack, zBack + ca])
  }

  // Side rails, bottom and top
  for (const [side, sx] of [['l', -1], ['r', 1]] as const) {
    const xa = sx * xIn
    const xb = sx * (xIn - ca)
    const [x0, x1] = [Math.min(xa, xb), Math.max(xa, xb)]
    const name = side === 'l' ? 'left' : 'right'
    cleat(`side-rail-bottom-${side}`, `Side rail bottom ${name}`, frame ? 'rail' : 'cleat', [x0, x1, yFloor, yFloor + cb, zRear, zFront])
    cleat(`side-rail-top-${side}`, `Side rail top ${name}`, frame ? 'rail' : 'cleat', [x0, x1, yTopUnder - cb, yTopUnder, zRear, zFront])
  }

  // Front posts + front rails (timber-frame only)
  if (frame) {
    for (const [side, sx] of [['l', -1], ['r', 1]] as const) {
      const xa = sx * xIn
      const xb = sx * (xIn - cb)
      cleat(`front-post-${side}`, `Front post ${side === 'l' ? 'left' : 'right'}`, 'post', [
        Math.min(xa, xb), Math.max(xa, xb), yFloor, yTopUnder, L / 2 - ca, L / 2,
      ])
    }
    const span: [number, number] = [-xIn + cb, xIn - cb]
    cleat('front-rail-bottom', 'Front rail bottom', 'rail', [...span, yFloor, yFloor + cb, L / 2 - ca, L / 2])
    cleat('front-rail-top', 'Front rail top', 'rail', [...span, yTopUnder - cb, yTopUnder, L / 2 - ca, L / 2])
  }

  // Shelves, each on a pair of side rails
  const [hMin, hMax] = shelfRange(dims, s, cab.method)
  const shelves = [...cab.shelves].filter((h) => h >= hMin && h <= hMax).sort((a, b) => a - b)
  shelves.forEach((h, i) => {
    const n = i + 1
    const yTop = yFloor + h
    add(`shelf-${n}`, `Shelf ${n}`, 'shelf', [-xIn, xIn, yTop - t, yTop, zRear, zFront])
    for (const [side, sx] of [['l', -1], ['r', 1]] as const) {
      const xa = sx * xIn
      const xb = sx * (xIn - ca)
      cleat(`shelf-${n}-rail-${side}`, `Shelf ${n} rail ${side === 'l' ? 'left' : 'right'}`, frame ? 'rail' : 'cleat', [
        Math.min(xa, xb), Math.max(xa, xb), yTop - t - cb, yTop - t, zRear, zFront,
      ])
    }
  })

  return parts
}

function cutFor(role: PartRole, material: 'osb' | 'timber', size: Vec3, grainLocked: boolean, s: Settings): Part['cut'] {
  const t = s.sheet.thickness
  const isStick = role === 'cleat' || role === 'post' || role === 'rail'
  if (material === 'timber') {
    return { length: Math.max(...size), width: s.timber.b, thickness: s.timber.a, laminations: 1 }
  }
  if (isStick) {
    return { length: Math.max(...size), width: s.osbCleat.width, thickness: t, laminations: s.osbCleat.laminations }
  }
  // A panel: drop the thickness axis. Grain-locked tops/shelves keep their span (X) as length.
  const dims = [size[0], size[1], size[2]]
  const tIdx = dims.reduce((best, v, i) => (Math.abs(v - t) < Math.abs(dims[best] - t) ? i : best), 0)
  const [a, b] = dims.filter((_, i) => i !== tIdx)
  if (grainLocked) return { length: size[0], width: size[2], thickness: t, laminations: 1 }
  return { length: Math.max(a, b), width: Math.min(a, b), thickness: t, laminations: 1 }
}
