import { describe, expect, test } from 'vitest'
import { analyze } from '../src/engine/analyze'
import { seedState } from '../src/engine/seed'
import type { PlanState } from '../src/engine/types'

const errors = (st: PlanState) => analyze(st).warnings.filter((w) => w.level === 'error')
const warns = (st: PlanState) => analyze(st).warnings.filter((w) => w.level === 'warn').map((w) => w.message)

describe('analyze on the seed state', () => {
  const d = analyze(seedState())

  test('has no errors or warnings, only MEASURE / stock infos', () => {
    expect(d.warnings.filter((w) => w.level !== 'info')).toEqual([])
    expect(d.warnings.some((w) => w.message.startsWith('MEASURE'))).toBe(true)
  })

  test('nests every OSB piece and fits the 7 sheets', () => {
    expect(d.nest.unplaced).toEqual([])
    expect(d.budget.sheetsUsed).toBeLessThanOrEqual(7)
    expect(d.budget.sheetsFraction).toBeGreaterThan(d.budget.sheetsUsed - 1)
    expect(d.budget.ok).toBe(true)
  })

  test('part codes are unique and lettered per cabinet', () => {
    const codes = Object.values(d.codes)
    expect(new Set(codes).size).toBe(codes.length)
    expect(codes).toContain('A1')
    expect(codes).toContain('F1')
  })
})

describe('checks', () => {
  test('a deck off the plane warns', () => {
    const st = seedState()
    st.cabinets[2].overrides.surfaceHeight = 600
    expect(warns(st).some((m) => m.includes('not on the 900 mm plane'))).toBe(true)
  })

  test('overlapping cabinets warn', () => {
    const st = seedState()
    st.cabinets[1].x = st.cabinets[0].x
    st.cabinets[1].z = st.cabinets[0].z
    expect(warns(st).some((m) => m.includes('overlaps'))).toBe(true)
  })

  test('touching cabinets do not count as overlapping', () => {
    const st = seedState()
    const a = analyze(st).dims
    st.cabinets[1].x = st.cabinets[0].x + a[st.cabinets[0].id].width / 2 + a[st.cabinets[1].id].width / 2
    st.cabinets[1].z = st.cabinets[0].z
    expect(warns(st).filter((m) => m.includes('overlaps'))).toEqual([])
  })

  test('rotation swaps the footprint axes for overlap', () => {
    const st = seedState()
    // Two 1000 × 600 fixtures side by side along Z, 700 apart: clear at 0°, overlapping when turned 90°.
    st.fixtures = [
      { ...st.fixtures[0], x: 5000, z: 0 },
      { ...st.fixtures[1], x: 5000, z: 700 },
    ]
    expect(warns(st).filter((m) => m.includes('overlaps'))).toEqual([])
    st.fixtures[0].rotation = 90
    expect(warns(st).some((m) => m.includes('overlaps'))).toBe(true)
  })

  test('a carcass with no room is an error and produces no parts', () => {
    const st = seedState()
    st.tools[0].deckHeight = 880
    const d = analyze(st)
    expect(d.parts['cab-gts10']).toEqual([])
    expect(d.warnings.some((w) => w.level === 'error' && w.objectId === 'cab-gts10')).toBe(true)
  })

  test('more sheets than stock is an error', () => {
    const st = seedState()
    st.settings.sheet.count = 1
    expect(errors(st).some((w) => w.message.includes('sheets of OSB'))).toBe(true)
  })

  test('a part bigger than a sheet is an error', () => {
    const st = seedState()
    st.cabinets[0].overrides.width = 2600
    expect(errors(st).some((w) => w.message.includes('does not fit on a sheet'))).toBe(true)
  })

  test('a tool bigger than its top warns', () => {
    const st = seedState()
    st.cabinets[2].overrides.width = 500
    expect(warns(st).some((m) => m.includes('overhangs'))).toBe(true)
  })

  test('something taller than the deck in a feed path warns', () => {
    const st = seedState()
    // Sander (its body stands above 900) straight behind the table saw.
    st.cabinets[1].x = -1500
    st.cabinets[1].z = -1600
    expect(warns(st).some((m) => m.includes("Table saw base's feed path"))).toBe(true)
  })

  test('timber shortfall is an error once stock is entered', () => {
    const st = seedState()
    st.settings.timber.stock = [{ length: 3000, qty: 1 }]
    expect(errors(st).some((w) => w.message.startsWith('Timber'))).toBe(true)
  })

  test('a fixture off the target height warns', () => {
    const st = seedState()
    st.fixtures[0].height = 880
    expect(warns(st).some((m) => m.includes('not 900'))).toBe(true)
  })
})
