import { describe, expect, test } from 'vitest'
import { analyze } from '../src/engine/analyze'
import { footprints } from '../src/engine/checks'
import { arrangeDefault } from '../src/engine/layout'
import { seedState } from '../src/engine/seed'

describe('default layout', () => {
  const st = seedState()
  const d = analyze(st)
  const fp = Object.fromEntries(footprints(st, d.dims).map((f) => [f.id, f]))
  const room = st.settings.room

  test('the room is 8 × 4 m and shown', () => {
    expect(room).toEqual({ enabled: true, width: 8000, length: 4000 })
  })

  test('the table saw is in the middle, turned to feed along the room, with an outfeed each side', () => {
    const saw = st.cabinets.find((c) => c.toolId === 'gts10')!
    expect([saw.x, saw.z, saw.rotation]).toEqual([0, 0, 90])
    const [a, b] = st.fixtures.map((f) => fp[f.id]).sort((p, q) => p.x - q.x)
    const s = fp[saw.id]
    expect(a.z).toBe(0)
    expect(b.z).toBe(0)
    // Butted up to the saw cabinet with a 20 mm gap, one on each side along the feed.
    expect(s.x - s.sx / 2 - (a.x + a.sx / 2)).toBeCloseTo(20)
    expect(b.x - b.sx / 2 - (s.x + s.sx / 2)).toBeCloseTo(20)
  })

  test('every other station stands against a long wall, 20 mm off it', () => {
    for (const c of st.cabinets.filter((c) => c.toolId !== 'gts10')) {
      const f = fp[c.id]
      const gap = room.length / 2 - (Math.abs(f.z) + f.sz / 2)
      expect(gap, c.name).toBeCloseTo(20)
    }
  })

  test('nothing is outside the room, overlapping, or blocking a feed path', () => {
    expect(d.warnings.filter((w) => w.level !== 'info')).toEqual([])
  })

  test('planer and thicknesser keep a full feed length apart and share the run-out to the walls', () => {
    const p = fp['cab-hms850']
    const t = fp['cab-2012nb']
    expect(t.x - t.sx / 2 - (p.x + p.sx / 2)).toBeCloseTo(st.settings.feedLength)
    const left = p.x - p.sx / 2 + room.width / 2
    const right = room.width / 2 - (t.x + t.sx / 2)
    expect(left).toBeCloseTo(right)
    expect(left).toBeCloseTo(2120) // 2100 of wall + the 20 mm wall gap
    // …which the checks mention as info, not as a warning.
    expect(d.warnings.some((w) => w.level === 'info' && w.objectId === 'cab-hms850' && w.message.includes('roll it out'))).toBe(true)
  })

  test('re-arranging keeps sizes and fits a narrower outfeed against the saw', () => {
    const custom = seedState()
    custom.fixtures[1] = { ...custom.fixtures[1], width: 500, x: 3000, z: 1500 }
    custom.cabinets[0] = { ...custom.cabinets[0], x: 123, z: 456 }
    const out = arrangeDefault(custom)
    expect(out.fixtures[1].width).toBe(500)
    const dd = analyze(out)
    const f = Object.fromEntries(footprints(out, dd.dims).map((x) => [x.id, x]))
    const saw = f['cab-gts10']
    const narrow = f[out.fixtures[1].id]
    const gap = narrow.x > 0 ? narrow.x - narrow.sx / 2 - (saw.x + saw.sx / 2) : saw.x - saw.sx / 2 - (narrow.x + narrow.sx / 2)
    expect(gap).toBeCloseTo(20)
    expect(dd.warnings.filter((w) => w.level !== 'info')).toEqual([])
  })

  test('cabinets for tools it does not know are left where they are', () => {
    const custom = seedState()
    custom.cabinets.push({ ...custom.cabinets[0], id: 'mine', toolId: null, x: 777, z: -333 })
    const out = arrangeDefault(custom)
    const mine = out.cabinets.find((c) => c.id === 'mine')!
    expect([mine.x, mine.z]).toEqual([777, -333])
  })
})
