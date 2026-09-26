import { describe, expect, test } from 'vitest'
import { analyze } from '../src/engine/analyze'
import { cabinetHardware, hardwareTotals } from '../src/engine/hardware'
import { cabinetParts, casterPositions, footPositions } from '../src/engine/parts'
import { seedState } from '../src/engine/seed'
import { cabinetDims } from '../src/engine/sizing'
import type { BuildMethod, Cabinet, Part } from '../src/engine/types'

const state = seedState()
const s = state.settings
const gts = state.tools.find((t) => t.id === 'gts10')!
const cab = (extra: Partial<Cabinet> = {}): Cabinet => ({
  id: 'c1',
  name: 'Table saw base',
  toolId: 'gts10',
  method: 'timber-cleat',
  casterHeight: 100,
  shelves: [200],
  hasBack: true,
  levelers: true,
  overrides: {},
  x: 0,
  z: 0,
  rotation: 0,
  ...extra,
})
const dimsOf = (c: Cabinet) => cabinetDims(c, gts, s)

describe('sizing with levelling feet', () => {
  test('the feet lift the casters travel/2 and the carcass gives up that height', () => {
    const d = dimsOf(cab())
    expect(d.lift).toBe(15)
    expect(d.baseHeight).toBe(115)
    expect(d.carcassHeight).toBe(415)
    expect(d.deckTop).toBe(900)
    expect(d.adjust).toEqual({ min: 885, max: 915 })
  })

  test('without feet nothing changes from the sheet', () => {
    const d = dimsOf(cab({ levelers: false }))
    expect([d.lift, d.baseHeight, d.carcassHeight, d.adjust]).toEqual([0, 100, 430, null])
  })
})

describe('foot parts', () => {
  const METHODS: BuildMethod[] = ['osb-cleat', 'timber-cleat', 'timber-frame']

  test.each(METHODS)('%s: four laminated OSB blocks hanging under the bottom', (method) => {
    const c = cab({ method })
    const d = dimsOf(c)
    const feet = cabinetParts(c, d, s).filter((p) => p.role === 'foot')
    expect(feet).toHaveLength(4)
    for (const f of feet) {
      expect(f.material).toBe('osb')
      expect([f.cut.length, f.cut.width, f.cut.laminations]).toEqual([60, 60, 5])
      // Top of the block against the underside of the bottom panel.
      expect(f.center[1] + f.size[1] / 2).toBeCloseTo(d.baseHeight)
      // Still 25 mm above the floor when the feet are wound up and it rolls on its casters.
      expect(d.casterHeight - f.size[1]).toBeGreaterThanOrEqual(25)
    }
  })

  test.each(METHODS)('%s: each rod comes up inside the box clear of all framing', (method) => {
    const c = cab({ method })
    const d = dimsOf(c)
    const framing = cabinetParts(c, d, s).filter((p) => ['cleat', 'rail', 'post'].includes(p.role))
    for (const [x, z] of footPositions(d, s, method)) {
      const rodR = s.leveler.rod / 2 + 2
      for (const p of framing) {
        const clearX = x + rodR <= p.center[0] - p.size[0] / 2 || x - rodR >= p.center[0] + p.size[0] / 2
        const clearZ = z + rodR <= p.center[2] - p.size[2] / 2 || z - rodR >= p.center[2] + p.size[2] / 2
        expect(clearX || clearZ, `rod at ${x},${z} hits ${p.label}`).toBe(true)
      }
    }
  })

  test('foot blocks stay clear of each caster swivel circle', () => {
    const c = cab()
    const d = dimsOf(c)
    const swivel = 0.6 * d.casterHeight
    for (const [cx, cz] of casterPositions(d)) {
      for (const [fx, fz] of footPositions(d, s, c.method)) {
        const half = s.leveler.block / 2
        const dx = Math.max(Math.abs(cx - fx) - half, 0)
        const dz = Math.max(Math.abs(cz - fz) - half, 0)
        expect(Math.hypot(dx, dz)).toBeGreaterThanOrEqual(swivel - 1e-6)
      }
    }
  })

  test('no feet part overlaps any other part', () => {
    const c = cab({ method: 'timber-frame' })
    const parts = cabinetParts(c, dimsOf(c), s)
    const vol = (a: Part, b: Part) =>
      [0, 1, 2].reduce((v, i) => v * Math.max(0, Math.min(a.center[i] + a.size[i] / 2, b.center[i] + b.size[i] / 2) - Math.max(a.center[i] - a.size[i] / 2, b.center[i] - b.size[i] / 2)), 1)
    for (const f of parts.filter((p) => p.role === 'foot')) for (const p of parts) if (p !== f) expect(vol(f, p)).toBeLessThan(1e-6)
  })

  test('a cabinet too narrow for feet beside its casters gets none', () => {
    const c = cab({ toolId: null, overrides: { width: 250, length: 400, surfaceHeight: 900 } })
    const d = cabinetDims(c, undefined, s)
    expect(footPositions(d, s, c.method)).toEqual([])
    expect(cabinetParts(c, d, s).filter((p) => p.role === 'foot')).toEqual([])
  })
})

describe('hardware', () => {
  test('feet need rod, T-nut, nuts, washer and a cap nut each, rod long enough for full travel', () => {
    const c = cab()
    const d = dimsOf(c)
    const hw = cabinetHardware(c, d, cabinetParts(c, d, s), s)
    const find = (k: string) => hw.find((h) => h.key === k)!
    // block 75 + bottom 15 + 30 of nuts inside + (115 + 15 − 75) below the block → 175 → 180
    expect(find('rod').spec).toBe('M12 threaded rod, cut to 180 mm')
    expect(find('rod').qty).toBe(4)
    expect(find('tnut').qty).toBe(4)
    expect(find('nut').qty).toBe(12)
    expect(find('capnut').qty).toBe(4)
    expect(find('caster').qty).toBe(4)
  })

  test('without feet only casters and their bolts', () => {
    const c = cab({ levelers: false })
    const d = dimsOf(c)
    expect(cabinetHardware(c, d, cabinetParts(c, d, s), s).map((h) => h.key).sort()).toEqual(['caster', 'caster-bolt'])
  })

  test('totals add up identical items across cabinets', () => {
    const c = cab()
    const d = dimsOf(c)
    const one = cabinetHardware(c, d, cabinetParts(c, d, s), s)
    const totals = hardwareTotals([one, one])
    expect(totals.find((h) => h.key === 'rod')!.qty).toBe(8)
  })
})

describe('levelling checks', () => {
  test('the seed plan is still clean', () => {
    expect(analyze(seedState()).warnings.filter((w) => w.level !== 'info')).toEqual([])
  })

  test('an outfeed a few mm off the plane is reachable with the feet: info, not a warning', () => {
    const st = seedState()
    st.fixtures[0].height = 895
    const w = analyze(st).warnings.filter((x) => x.objectId === st.fixtures[0].id)
    expect(w.some((x) => x.level === 'info' && x.message.includes('895'))).toBe(true)
    expect(w.some((x) => x.level === 'warn')).toBe(false)
  })

  test('an outfeed beyond the feet travel warns', () => {
    const st = seedState()
    st.fixtures[0].height = 870
    expect(analyze(st).warnings.some((x) => x.level === 'warn' && x.objectId === st.fixtures[0].id)).toBe(true)
  })

  test('a narrow, tall cabinet warns about tipping', () => {
    const st = seedState()
    st.cabinets[0].overrides = { width: 300, length: 300 }
    expect(analyze(st).warnings.some((x) => x.level === 'warn' && x.message.includes('tip'))).toBe(true)
  })
})
