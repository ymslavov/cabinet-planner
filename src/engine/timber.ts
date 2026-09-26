import type { StockLength } from './types'

/**
 * 1D cutting of timber lengths: best-fit decreasing with kerf.
 * Pieces go longest-first into the open bar with the least room left that still fits; a new
 * bar comes from the longest remaining stock length that fits, and once stock runs out (or
 * none was entered) from unlimited bars of `defaultLength`.
 */

export interface TimberPiece {
  id: string
  label: string
  length: number
}

export interface TimberBar {
  stockLength: number
  fromStock: boolean
  cuts: { pieceId: string; label: string; length: number; offset: number }[]
  /** Length left after the last cut and its kerf. */
  offcut: number
}

export interface TimberResult {
  bars: TimberBar[]
  /** Sum of all piece lengths (what the build consumes before kerf). */
  totalLength: number
  /** False when no stock was entered — bars are then just a shopping list. */
  stockKnown: boolean
  /** Bars needed beyond the entered stock (0 when stock is unknown). */
  shortfall: number
  oversize: TimberPiece[]
}

export function packTimber(
  pieces: TimberPiece[],
  stock: StockLength[],
  opts: { kerf: number; defaultLength: number },
): TimberResult {
  const stockKnown = stock.some((s) => s.qty > 0 && s.length > 0)
  const remaining = stock.flatMap((s) => Array.from({ length: Math.max(0, s.qty) }, () => s.length)).sort((a, b) => b - a)
  const maxLen = Math.max(opts.defaultLength, ...remaining, 0)

  const oversize = pieces.filter((p) => p.length > maxLen)
  const ordered = pieces
    .filter((p) => p.length <= maxLen)
    .sort((a, b) => b.length - a.length || a.id.localeCompare(b.id))

  const bars: (TimberBar & { used: number })[] = []
  for (const p of ordered) {
    let best = -1
    for (let i = 0; i < bars.length; i++) {
      const room = bars[i].stockLength - bars[i].used
      if (room >= p.length && (best < 0 || room < bars[best].stockLength - bars[best].used)) best = i
    }
    if (best < 0) {
      const idx = remaining.findIndex((len) => len >= p.length)
      if (idx >= 0) {
        bars.push({ stockLength: remaining[idx], fromStock: true, cuts: [], offcut: 0, used: 0 })
        remaining.splice(idx, 1)
      } else if (p.length <= opts.defaultLength) {
        bars.push({ stockLength: opts.defaultLength, fromStock: false, cuts: [], offcut: 0, used: 0 })
      } else {
        oversize.push(p)
        continue
      }
      best = bars.length - 1
    }
    const bar = bars[best]
    bar.cuts.push({ pieceId: p.id, label: p.label, length: p.length, offset: bar.used })
    bar.used += p.length + opts.kerf
  }

  return {
    bars: bars.map(({ used, ...bar }) => ({ ...bar, offcut: Math.max(0, bar.stockLength - used) })),
    totalLength: pieces.reduce((sum, p) => sum + p.length, 0),
    stockKnown,
    shortfall: stockKnown ? bars.filter((b) => !b.fromStock).length : 0,
    oversize,
  }
}
