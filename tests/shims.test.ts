import { describe, expect, test } from 'vitest'
import { analyze } from '../src/engine/analyze'
import { cabinetHardware } from '../src/engine/hardware'
import { cabinetParts } from '../src/engine/parts'
import { seedState } from '../src/engine/seed'
import { cabinetDims } from '../src/engine/sizing'
import type { Cabinet } from '../src/engine/types'

const state = seedState()
const s = state.settings
const tool = (id: string) => state.tools.find((t) => t.id === id)!
const cab = (toolId: string | null, extra: Partial<Cabinet> = {}): Cabinet => ({
  id: 'c1',
  name: 'Base',
  toolId,
  method: 'timber-cleat',
  casterHeight: 100,
  shelves: [200],
  hasBack: true,
  overrides: {},
  x: 0,
  z: 0,
  rotation: 0,
  ...extra,
})

describe('shim allowance', () => {
  test('the top is built 10 mm low and the tool sits on a 10 mm shim stack at 900', () => {
    const d = cabinetDims(cab('gts10'), tool('gts10'), s)
    expect(s.shimAllowance).toBe(10)
    expect(d.surfaceHeight).toBe(550)
    expect(d.shim).toBe(10)
    expect(d.carcassHeight).toBe(420)
    expect(d.deckTop).toBe(900)
    // Take the shims out or double them: ±10.
    expect(d.adjust).toEqual({ min: 890, max: 910 })
  })

  test('exempt tools and plain cabinets get no shims', () => {
    const drill = cabinetDims(cab('pbd40'), tool('pbd40'), s)
    expect([drill.shim, drill.adjust, drill.surfaceHeight]).toEqual([0, null, 800])
    const plain = cabinetDims(cab(null), undefined, s)
    expect([plain.shim, plain.adjust, plain.surfaceHeight]).toEqual([0, null, 900])
  })

  test('an allowance of 0 gives the sheet’s numbers', () => {
    const d = cabinetDims(cab('gts10'), tool('gts10'), { ...s, shimAllowance: 0 })
    expect([d.surfaceHeight, d.carcassHeight, d.shim, d.adjust]).toEqual([560, 430, 0, null])
  })

  test('the casters stand on the floor: the bottom panel sits right on them', () => {
    const c = cab('gts10')
    const d = cabinetDims(c, tool('gts10'), s)
    const bottom = cabinetParts(c, d, s).find((p) => p.role === 'bottom')!
    expect(bottom.center[1] - bottom.size[1] / 2).toBe(100)
  })
})

describe('shim hardware', () => {
  test('a shimmed tool gets four slotted shim stacks; nothing else beyond casters', () => {
    const c = cab('gts10')
    const d = cabinetDims(c, tool('gts10'), s)
    const hw = cabinetHardware(c, d, cabinetParts(c, d, s), s)
    expect(hw.map((h) => h.key).sort()).toEqual(['caster', 'caster-bolt', 'shims'])
    expect(hw.find((h) => h.key === 'shims')!.qty).toBe(4)
  })

  test('the drill press gets no shims', () => {
    const c = cab('pbd40')
    const d = cabinetDims(c, tool('pbd40'), s)
    expect(cabinetHardware(c, d, cabinetParts(c, d, s), s).some((h) => h.key === 'shims')).toBe(false)
  })
})

describe('outfeed height against the shims', () => {
  test('the seed plan is clean', () => {
    expect(analyze(seedState()).warnings.filter((w) => w.level !== 'info')).toEqual([])
  })

  test('an outfeed 5 mm low: info, take 5 mm of shims out', () => {
    const st = seedState()
    st.fixtures[0].height = 895
    const w = analyze(st).warnings.filter((x) => x.objectId === st.fixtures[0].id)
    expect(w.some((x) => x.level === 'info' && x.message.includes('take out 5 mm'))).toBe(true)
    expect(w.some((x) => x.level === 'warn')).toBe(false)
  })

  test('an outfeed beyond the shim range warns', () => {
    const st = seedState()
    st.fixtures[0].height = 880
    expect(analyze(st).warnings.some((x) => x.level === 'warn' && x.objectId === st.fixtures[0].id)).toBe(true)
  })

  test('a narrow, tall cabinet still warns about tipping on its casters', () => {
    const st = seedState()
    st.cabinets[0].overrides = { width: 300, length: 300 }
    expect(analyze(st).warnings.some((x) => x.level === 'warn' && x.message.includes('tip'))).toBe(true)
  })
})
