import { describe, expect, test } from 'vitest'
import { cabinetParts, framing } from '../src/engine/parts'
import { cabinetDims } from '../src/engine/sizing'
import { seedState } from '../src/engine/seed'
import type { BuildMethod, Cabinet, Part, Settings } from '../src/engine/types'

const state = seedState()
// Panel sizes below are the sheet's, which has no shim allowance.
const s = { ...state.settings, shimAllowance: 0 }
const gts = state.tools.find((t) => t.id === 'gts10')!
const METHODS: BuildMethod[] = ['osb-cleat', 'timber-cleat', 'timber-frame']

const cab = (extra: Partial<Cabinet> = {}): Cabinet => ({
  id: 'c1',
  name: 'Table saw base',
  toolId: 'gts10',
  method: 'osb-cleat',
  casterHeight: 100,
  shelves: [200],
  hasBack: true,
  overrides: {},
  x: 0,
  z: 0,
  rotation: 0,
  ...extra,
})

const partsFor = (c: Cabinet, settings: Settings = s) => cabinetParts(c, cabinetDims(c, gts, settings), settings)
const byRole = (parts: Part[], role: Part['role']) => parts.filter((p) => p.role === role)

function overlapVolume(a: Part, b: Part): number {
  let v = 1
  for (let i = 0; i < 3; i++) {
    const lo = Math.max(a.center[i] - a.size[i] / 2, b.center[i] - b.size[i] / 2)
    const hi = Math.min(a.center[i] + a.size[i] / 2, b.center[i] + b.size[i] / 2)
    v *= Math.max(0, hi - lo)
  }
  return v
}

describe.each(METHODS)('%s', (method) => {
  const parts = partsFor(cab({ method }))

  test('has the open-box panel set', () => {
    expect(byRole(parts, 'bottom')).toHaveLength(1)
    expect(byRole(parts, 'back')).toHaveLength(1)
    expect(byRole(parts, 'side')).toHaveLength(2)
    expect(byRole(parts, 'top')).toHaveLength(s.topLayers)
    expect(byRole(parts, 'shelf')).toHaveLength(1)
  })

  test('panel cut sizes for the GTS 10 base (790 × 620, carcass 430, t 15)', () => {
    const cut = (p: Part) => [p.cut.length, p.cut.width, p.cut.thickness]
    expect(cut(byRole(parts, 'bottom')[0])).toEqual([790, 620, 15])
    expect(cut(byRole(parts, 'back')[0])).toEqual([790, 415, 15])
    expect(cut(byRole(parts, 'side')[0])).toEqual([605, 415, 15])
    for (const top of byRole(parts, 'top')) expect(cut(top)).toEqual([790, 620, 15])
  })

  test('every part has positive size and lies inside the cabinet envelope', () => {
    const d = cabinetDims(cab({ method }), gts, s)
    for (const p of parts) {
      for (let i = 0; i < 3; i++) expect(p.size[i]).toBeGreaterThan(0)
      const eps = 1e-6
      expect(p.center[0] - p.size[0] / 2).toBeGreaterThanOrEqual(-d.width / 2 - eps)
      expect(p.center[0] + p.size[0] / 2).toBeLessThanOrEqual(d.width / 2 + eps)
      expect(p.center[1] - p.size[1] / 2).toBeGreaterThanOrEqual(d.casterHeight - eps)
      expect(p.center[1] + p.size[1] / 2).toBeLessThanOrEqual(d.surfaceHeight + eps)
      expect(p.center[2] - p.size[2] / 2).toBeGreaterThanOrEqual(-d.length / 2 - eps)
      expect(p.center[2] + p.size[2] / 2).toBeLessThanOrEqual(d.length / 2 + eps)
    }
  })

  test('no two parts occupy the same space', () => {
    for (let i = 0; i < parts.length; i++)
      for (let j = i + 1; j < parts.length; j++)
        expect(overlapVolume(parts[i], parts[j]), `${parts[i].label} ∩ ${parts[j].label}`).toBeLessThan(1e-6)
  })

  test('the top surface lands exactly at the cabinet surface height', () => {
    const topMost = Math.max(...parts.map((p) => p.center[1] + p.size[1] / 2))
    expect(topMost).toBeCloseTo(560)
  })

  test('without a back panel the box still generates without overlaps', () => {
    const noBack = partsFor(cab({ method, hasBack: false }))
    expect(byRole(noBack, 'back')).toHaveLength(0)
    for (let i = 0; i < noBack.length; i++)
      for (let j = i + 1; j < noBack.length; j++) expect(overlapVolume(noBack[i], noBack[j])).toBeLessThan(1e-6)
  })
})

describe('framing by method', () => {
  test('osb-cleat uses laminated OSB cleats and no timber', () => {
    const parts = partsFor(cab({ method: 'osb-cleat' }))
    expect(parts.filter((p) => p.material === 'timber')).toHaveLength(0)
    const cleats = byRole(parts, 'cleat')
    expect(cleats.length).toBeGreaterThan(0)
    for (const c of cleats) {
      expect(c.material).toBe('osb')
      expect(c.cut.laminations).toBe(3)
      expect(c.cut.width).toBe(60)
    }
    expect(framing(s, 'osb-cleat')).toEqual({ ca: 45, cb: 60, material: 'osb' })
  })

  test('timber-cleat uses 30 × 40 timber for every cleat', () => {
    const parts = partsFor(cab({ method: 'timber-cleat' }))
    expect(parts.filter((p) => p.material === 'osb' && p.role === 'cleat')).toHaveLength(0)
    for (const c of parts.filter((p) => p.material === 'timber')) {
      expect([c.cut.thickness, c.cut.width]).toEqual([30, 40])
    }
  })

  test('timber-frame adds front posts and front rails to the cleat layout', () => {
    const cleat = partsFor(cab({ method: 'timber-cleat' })).filter((p) => p.material === 'timber')
    const frame = partsFor(cab({ method: 'timber-frame' })).filter((p) => p.material === 'timber')
    expect(frame.length).toBeGreaterThanOrEqual(cleat.length + 4)
    expect(byRole(frame, 'post').length).toBeGreaterThanOrEqual(2)
  })
})

describe('degenerate input', () => {
  test('non-positive carcass → no parts', () => {
    const c = cab({ overrides: { surfaceHeight: 120 } })
    expect(partsFor(c)).toEqual([])
  })

  test('a shallow cleat cabinet is still built: only the rear cleat eats into its depth', () => {
    // 100 deep, osb-cleat: back 15 + rear cleat 45 leaves a 40 mm span for rails and shelves.
    const c = cab({ toolId: null, shelves: [], overrides: { width: 600, length: 100, surfaceHeight: 900 } })
    const parts = cabinetParts(c, cabinetDims(c, undefined, s), s)
    expect(parts.length).toBeGreaterThan(0)
  })

  test('shelves outside the usable height are dropped', () => {
    const parts = partsFor(cab({ shelves: [5, 200, 9999] }))
    expect(byRole(parts, 'shelf')).toHaveLength(1)
  })

  test('respectGrain locks tops and shelves, never carcass panels', () => {
    const parts = partsFor(cab(), { ...s, respectGrain: true })
    for (const p of parts) expect(p.grainLocked).toBe(p.role === 'top' || p.role === 'shelf')
  })

  test('ids are unique', () => {
    const parts = partsFor(cab({ method: 'timber-frame', shelves: [150, 300] }))
    expect(new Set(parts.map((p) => p.id)).size).toBe(parts.length)
  })
})
