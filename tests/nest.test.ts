import { describe, expect, test } from 'vitest'
import { nestSheets, type NestPiece, type NestResult, type SheetSpec } from '../src/engine/nest'

const SHEET: SheetSpec = { length: 2500, width: 1500, kerf: 3, trim: 0 }

const pieces = (n: number, length: number, width: number, canRotate = true, prefix = 'p'): NestPiece[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, label: `${prefix}${i}`, length, width, canRotate }))

function assertValid(res: NestResult, sheet: SheetSpec) {
  const eps = 1e-6
  for (const s of res.sheets) {
    for (const p of s.placements) {
      expect(p.x).toBeGreaterThanOrEqual(sheet.trim - eps)
      expect(p.y).toBeGreaterThanOrEqual(sheet.trim - eps)
      expect(p.x + p.w).toBeLessThanOrEqual(sheet.length - sheet.trim + eps)
      expect(p.y + p.h).toBeLessThanOrEqual(sheet.width - sheet.trim + eps)
    }
    for (let i = 0; i < s.placements.length; i++)
      for (let j = i + 1; j < s.placements.length; j++) {
        const a = s.placements[i]
        const b = s.placements[j]
        const apart =
          a.x + a.w + sheet.kerf <= b.x + eps ||
          b.x + b.w + sheet.kerf <= a.x + eps ||
          a.y + a.h + sheet.kerf <= b.y + eps ||
          b.y + b.h + sheet.kerf <= a.y + eps
        expect(apart, `${a.label} vs ${b.label} need a kerf between them`).toBe(true)
      }
  }
}

const placedIds = (res: NestResult) => res.sheets.flatMap((s) => s.placements.map((p) => p.pieceId))

describe('nestSheets', () => {
  test('one piece goes to the sheet origin', () => {
    const res = nestSheets(pieces(1, 800, 600), SHEET)
    expect(res.sheets).toHaveLength(1)
    expect(res.sheets[0].placements[0]).toMatchObject({ x: 0, y: 0 })
  })

  test('a piece the full size of the sheet needs no kerf', () => {
    const res = nestSheets(pieces(1, 2500, 1500), SHEET)
    expect(res.sheets).toHaveLength(1)
    expect(res.unplaced).toHaveLength(0)
  })

  test('kerf is respected: 1250 × 750 fits 3 per sheet with a 3 mm kerf, 4 with none', () => {
    expect(nestSheets(pieces(20, 1250, 750), SHEET).sheets).toHaveLength(7)
    expect(nestSheets(pieces(20, 1250, 750), { ...SHEET, kerf: 0 }).sheets).toHaveLength(5)
  })

  test('edge trim shrinks the usable sheet', () => {
    const res = nestSheets(pieces(1, 2500, 1500), { ...SHEET, trim: 5 })
    expect(res.sheets).toHaveLength(0)
    expect(res.unplaced.map((p) => p.id)).toEqual(['p0'])
  })

  test('an oversize piece is reported and the rest still nest', () => {
    const input = [...pieces(1, 2600, 700, true, 'big'), ...pieces(4, 500, 400)]
    const res = nestSheets(input, SHEET)
    expect(res.unplaced.map((p) => p.id)).toEqual(['big0'])
    expect(placedIds(res).sort()).toEqual(['p0', 'p1', 'p2', 'p3'])
  })

  test('a piece that only fits rotated is rotated when allowed, rejected when locked', () => {
    const tall = [{ id: 'a', label: 'a', length: 1400, width: 1600, canRotate: true }]
    expect(nestSheets(tall, SHEET).sheets[0].placements[0].rotated).toBe(true)
    expect(nestSheets([{ ...tall[0], canRotate: false }], SHEET).unplaced).toHaveLength(1)
  })

  test('locked pieces keep their length along the sheet length', () => {
    const res = nestSheets(pieces(6, 700, 500, false), SHEET)
    for (const p of res.sheets.flatMap((s) => s.placements)) {
      expect(p.rotated).toBe(false)
      expect([p.w, p.h]).toEqual([700, 500])
    }
  })

  test('a realistic mixed cut list places every piece validly and deterministically', () => {
    const input = [
      ...pieces(4, 790, 620, true, 'top'),
      ...pieces(3, 605, 415, true, 'side'),
      ...pieces(2, 790, 415, true, 'back'),
      ...pieces(30, 545, 60, true, 'strip'),
      ...pieces(6, 680, 60, true, 'rail'),
    ]
    const a = nestSheets(input, SHEET)
    const b = nestSheets(input, SHEET)
    assertValid(a, SHEET)
    expect(placedIds(a).sort()).toEqual(input.map((p) => p.id).sort())
    expect(a).toEqual(b)
    expect(a.sheets.length).toBeLessThanOrEqual(2)
  })

  test('used area and offcuts are reported per sheet', () => {
    const res = nestSheets(pieces(2, 1000, 500), SHEET)
    expect(res.sheets[0].usedArea).toBe(2 * 1000 * 500)
    expect(res.sheets[0].freeRects.length).toBeGreaterThan(0)
  })

  test('many small pieces stay valid', () => {
    const input = Array.from({ length: 120 }, (_, i) => ({
      id: `r${i}`,
      label: `r${i}`,
      length: 100 + ((i * 37) % 600),
      width: 40 + ((i * 53) % 300),
      canRotate: i % 3 !== 0,
    }))
    const res = nestSheets(input, SHEET)
    assertValid(res, SHEET)
    expect(placedIds(res)).toHaveLength(120)
  })
})

/** Replays the cut list: every cut must span a whole region, and the pieces must come out exactly. */
function replayCuts(sheet: NestResult['sheets'][number], spec: SheetSpec) {
  let regions: { x: number; y: number; w: number; h: number }[] = [
    { x: spec.trim, y: spec.trim, w: spec.length - 2 * spec.trim, h: spec.width - 2 * spec.trim },
  ]
  const eps = 1e-6
  for (const c of sheet.cuts) {
    const idx = regions.findIndex((r) =>
      c.kind === 'rip'
        ? Math.abs(r.x - c.x1) < eps && Math.abs(r.x + r.w - c.x2) < eps && c.y1 > r.y + eps && c.y1 < r.y + r.h - eps
        : Math.abs(r.y - c.y1) < eps && Math.abs(r.y + r.h - c.y2) < eps && c.x1 > r.x + eps && c.x1 < r.x + r.w - eps,
    )
    expect(idx, `cut ${c.n} does not run edge to edge across one region`).toBeGreaterThanOrEqual(0)
    const r = regions[idx]
    const parts =
      c.kind === 'rip'
        ? [
            { x: r.x, y: r.y, w: r.w, h: c.y1 - r.y },
            { x: r.x, y: c.y1 + spec.kerf, w: r.w, h: r.y + r.h - c.y1 - spec.kerf },
          ]
        : [
            { x: r.x, y: r.y, w: c.x1 - r.x, h: r.h },
            { x: c.x1 + spec.kerf, y: r.y, w: r.x + r.w - c.x1 - spec.kerf, h: r.h },
          ]
    regions.splice(idx, 1, ...parts.filter((p) => p.w > eps && p.h > eps))
  }
  for (const p of sheet.placements) {
    const exact = regions.some((r) => Math.abs(r.x - p.x) < eps && Math.abs(r.y - p.y) < eps && Math.abs(r.w - p.w) < eps && Math.abs(r.h - p.h) < eps)
    expect(exact, `${p.label} is not cut free by the cut list`).toBe(true)
  }
  regions = regions.filter((r) => !sheet.placements.some((p) => Math.abs(r.x - p.x) < eps && Math.abs(r.y - p.y) < eps))
  return regions
}

describe('cut plan', () => {
  test('a full-sheet piece needs no cuts', () => {
    expect(nestSheets(pieces(1, 2500, 1500), SHEET).sheets[0].cuts).toEqual([])
  })

  test('one piece takes two cuts and leaves two offcuts, the bigger one as big as possible', () => {
    const res = nestSheets(pieces(1, 800, 600), SHEET)
    const s = res.sheets[0]
    expect(s.cuts).toHaveLength(2)
    replayCuts(s, SHEET)
    expect(s.freeRects).toHaveLength(2)
    // Turned so only 600 runs along the sheet, then crosscut first: a 1897 × 1500 offcut,
    // rather than 1697 × 1500 (unturned) or 2500 × 897 (rip first).
    expect(Math.max(...s.freeRects.map((r) => r.w * r.h))).toBe(1897 * 1500)
  })

  test('full-length strips are cut as rips only', () => {
    const res = nestSheets(pieces(6, 2500, 200), SHEET)
    const s = res.sheets[0]
    expect(s.cuts.every((c) => c.kind === 'rip')).toBe(true)
    expect(s.cuts).toHaveLength(6)
    replayCuts(s, SHEET)
  })

  test('four quarter panels come out in three cuts per sheet', () => {
    const res = nestSheets(pieces(8, 1250, 750), { ...SHEET, kerf: 0 })
    expect(res.sheets).toHaveLength(2)
    for (const s of res.sheets) expect(s.cuts).toHaveLength(3)
    expect(res.stats.cuts).toBe(6)
  })

  test('cuts between two pieces of waste are dropped and the waste merges', () => {
    const res = nestSheets(pieces(3, 400, 300), SHEET)
    const s = res.sheets[0]
    const left = replayCuts(s, SHEET)
    expect(left.length).toBe(s.freeRects.length)
    // Every cut touches a piece.
    for (const c of s.cuts) {
      const touches = s.placements.some((p) =>
        c.kind === 'rip'
          ? (Math.abs(p.y + p.h - c.y1) < 1e-6 || Math.abs(p.y - (c.y1 + SHEET.kerf)) < 1e-6) && p.x < c.x2 && p.x + p.w > c.x1
          : (Math.abs(p.x + p.w - c.x1) < 1e-6 || Math.abs(p.x - (c.x1 + SHEET.kerf)) < 1e-6) && p.y < c.y2 && p.y + p.h > c.y1,
      )
      expect(touches, `cut ${c.n} only separates waste`).toBe(true)
    }
  })

  test('a realistic cut list replays cleanly on every sheet, numbered in order', () => {
    const input = [
      ...pieces(4, 790, 620, true, 'top'),
      ...pieces(3, 605, 415, true, 'side'),
      ...pieces(2, 790, 415, true, 'back'),
      ...pieces(30, 545, 60, true, 'strip'),
      ...pieces(5, 255, 60, true, 'foot'),
    ]
    const res = nestSheets(input, SHEET)
    for (const s of res.sheets) {
      replayCuts(s, SHEET)
      expect(s.cuts.map((c) => c.n)).toEqual(s.cuts.map((_, i) => i + 1))
    }
    expect(res.stats.cuts).toBe(res.sheets.reduce((n, s) => n + s.cuts.length, 0))
    expect(res.stats.largestOffcut).not.toBeNull()
  })

  test('prefers fewer cuts when the sheet count is the same', () => {
    // Ten 2500-long strips of mixed width: rips only is 10 cuts; anything else is more.
    const input = [...pieces(5, 2500, 120, true, 'a'), ...pieces(5, 2500, 150, true, 'b')]
    expect(nestSheets(input, SHEET).stats.cuts).toBe(10)
  })
})
