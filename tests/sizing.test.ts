import { describe, expect, test } from 'vitest'
import { cabinetDims } from '../src/engine/sizing'
import { seedState } from '../src/engine/seed'
import type { Cabinet } from '../src/engine/types'

const state = seedState()
const s = state.settings
const tool = (id: string) => state.tools.find((t) => t.id === id)!
const cab = (toolId: string | null, extra: Partial<Cabinet> = {}): Cabinet => ({
  id: 'c',
  name: 'c',
  toolId,
  method: 'osb-cleat',
  casterHeight: 100,
  shelves: [],
  hasBack: true,
  levelers: false,
  overrides: {},
  x: 0,
  z: 0,
  rotation: 0,
  ...extra,
})

// Rows straight from the planning spreadsheet (100 mm casters, 2 × 15 top, 25 clearance).
describe('cabinetDims matches the planning sheet', () => {
  test.each([
    ['gts10', 790, 620, 560, 430],
    ['2012nb', 530, 420, 710, 580],
    ['bts700', 530, 440, 670, 540],
    ['gcm8', 610, 480, 805, 675],
    ['hms850', 840, 500, 545, 415],
    ['pbd40', 380, 400, 800, 670],
  ])('%s → %i × %i, surface %i, carcass %i', (id, w, l, surface, carcass) => {
    const d = cabinetDims(cab(id), tool(id), s)
    expect(d.width).toBe(w)
    expect(d.length).toBe(l)
    expect(d.surfaceHeight).toBe(surface)
    expect(d.carcassHeight).toBe(carcass)
  })

  test('non-exempt tool decks land on the target plane', () => {
    for (const id of ['gts10', '2012nb', 'bts700', 'gcm8', 'hms850']) {
      expect(cabinetDims(cab(id), tool(id), s).deckTop).toBe(900)
    }
  })
})

describe('cabinetDims inputs', () => {
  test('overrides win over computed values', () => {
    const d = cabinetDims(cab('gts10', { overrides: { width: 900, length: 700, surfaceHeight: 600 } }), tool('gts10'), s)
    expect([d.width, d.length, d.surfaceHeight, d.carcassHeight]).toEqual([900, 700, 600, 470])
  })

  test('measured sheet thickness flows into the top', () => {
    const d = cabinetDims(cab('gts10'), tool('gts10'), { ...s, sheet: { ...s.sheet, thickness: 15.4 } })
    expect(d.topThickness).toBeCloseTo(30.8)
    expect(d.carcassHeight).toBeCloseTo(429.2)
  })

  test('caster height is per cabinet', () => {
    expect(cabinetDims(cab('gts10', { casterHeight: 125 }), tool('gts10'), s).carcassHeight).toBe(405)
  })

  test('no tool → 600 × 600 at the target height, no deck', () => {
    const d = cabinetDims(cab(null), undefined, s)
    expect([d.width, d.length, d.surfaceHeight, d.deckTop]).toEqual([600, 600, 900, null])
  })

  test('a deck above the target plane gives a non-positive carcass instead of throwing', () => {
    const tall = { ...tool('gts10'), deckHeight: 850 }
    expect(cabinetDims(cab('gts10'), tall, s).carcassHeight).toBeLessThanOrEqual(0)
  })
})
