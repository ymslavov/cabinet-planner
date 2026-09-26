import { describe, expect, test } from 'vitest'
import { packTimber, type TimberPiece } from '../src/engine/timber'

const pcs = (...lengths: number[]): TimberPiece[] => lengths.map((length, i) => ({ id: `t${i}`, label: `t${i}`, length }))
const opts = { kerf: 3, defaultLength: 3000 }

describe('packTimber', () => {
  test('packs pieces into one bar, leaving a kerf between cuts', () => {
    const res = packTimber(pcs(1000, 1000, 900), [{ length: 3000, qty: 1 }], opts)
    expect(res.bars).toHaveLength(1)
    expect(res.bars[0].fromStock).toBe(true)
    expect(res.bars[0].cuts.map((c) => c.offset)).toEqual([0, 1003, 2006])
    expect(res.shortfall).toBe(0)
    expect(res.totalLength).toBe(2900)
  })

  test('kerf pushes a piece onto a second bar', () => {
    const res = packTimber(pcs(1500, 1499), [{ length: 3000, qty: 2 }], opts)
    expect(res.bars).toHaveLength(2)
  })

  test('unknown stock → default-length bars, not a shortfall', () => {
    const res = packTimber(pcs(2000, 2000, 500), [], opts)
    expect(res.stockKnown).toBe(false)
    expect(res.bars.every((b) => b.stockLength === 3000 && !b.fromStock)).toBe(true)
    expect(res.bars).toHaveLength(2)
    expect(res.shortfall).toBe(0)
  })

  test('running out of stock counts extra bars as shortfall', () => {
    const res = packTimber(pcs(1500, 1500), [{ length: 2000, qty: 1 }], opts)
    expect(res.bars.filter((b) => b.fromStock)).toHaveLength(1)
    expect(res.shortfall).toBe(1)
  })

  test('a piece longer than any bar is oversize, the rest still pack', () => {
    const res = packTimber(pcs(3500, 400), [{ length: 3000, qty: 2 }], opts)
    expect(res.oversize.map((p) => p.length)).toEqual([3500])
    expect(res.bars.flatMap((b) => b.cuts)).toHaveLength(1)
  })

  test('uses short stock where it fits before opening long bars', () => {
    const res = packTimber(pcs(2400, 900), [{ length: 2400, qty: 1 }, { length: 1000, qty: 1 }], opts)
    expect(res.shortfall).toBe(0)
    expect(res.bars.map((b) => b.stockLength).sort()).toEqual([1000, 2400])
  })

  test('offcut never goes negative', () => {
    const res = packTimber(pcs(3000), [{ length: 3000, qty: 1 }], opts)
    expect(res.bars[0].offcut).toBe(0)
  })
})
