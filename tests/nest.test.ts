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
