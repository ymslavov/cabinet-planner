/**
 * Guillotine sheet nesting for a track saw.
 *
 * Every placement is carved out of a free rectangle with two straight cuts that run the full
 * width or height of that rectangle, so the result can always be cut with edge-to-edge
 * rips and crosscuts. A kerf is left between neighbours but not against the sheet edge.
 *
 * Sheet space: x runs along the sheet length (the OSB strong axis), y along the width.
 * A piece's `length` lies along x unless the placement is `rotated`.
 *
 * No single greedy heuristic wins on every cut list, so we run every combination of sort
 * order × fit rule × split rule and keep the best result (fewest sheets, then the emptiest
 * last sheet so the leftover is one big usable offcut).
 */

export interface NestPiece {
  id: string
  label: string
  length: number
  width: number
  canRotate: boolean
}

export interface SheetSpec {
  length: number
  width: number
  kerf: number
  trim: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Placement extends Rect {
  pieceId: string
  label: string
  rotated: boolean
}

export interface NestedSheet {
  placements: Placement[]
  usedArea: number
  /** Leftover free rectangles — the offcuts. */
  freeRects: Rect[]
}

export interface NestResult {
  sheets: NestedSheet[]
  /** Pieces that don't fit an empty sheet in any allowed orientation. */
  unplaced: NestPiece[]
  heuristic: string
}

type SortRule = 'area' | 'long' | 'short' | 'perimeter'
type FitRule = 'baf' | 'bssf' | 'blsf'
type SplitRule = 'rip' | 'cross' | 'sas' | 'las' | 'slas' | 'llas' | 'minas' | 'maxas'

const SORTS: SortRule[] = ['area', 'long', 'short', 'perimeter']
const FITS: FitRule[] = ['baf', 'bssf', 'blsf']
const SPLITS: SplitRule[] = ['rip', 'cross', 'sas', 'las', 'slas', 'llas', 'minas', 'maxas']

function orientations(p: NestPiece): { w: number; h: number; rotated: boolean }[] {
  const out = [{ w: p.length, h: p.width, rotated: false }]
  if (p.canRotate && p.length !== p.width) out.push({ w: p.width, h: p.length, rotated: true })
  return out
}

function sortKey(p: NestPiece, rule: SortRule): number {
  const long = Math.max(p.length, p.width)
  const short = Math.min(p.length, p.width)
  switch (rule) {
    case 'area':
      return p.length * p.width
    case 'long':
      return long * 1e6 + short
    case 'short':
      return short * 1e6 + long
    case 'perimeter':
      return p.length + p.width
  }
}

function fitScore(f: Rect, w: number, h: number, rule: FitRule): [number, number] {
  const dw = f.w - w
  const dh = f.h - h
  const short = Math.min(dw, dh)
  const long = Math.max(dw, dh)
  switch (rule) {
    case 'baf':
      return [f.w * f.h - w * h, short]
    case 'bssf':
      return [short, long]
    case 'blsf':
      return [long, short]
  }
}

function splitHorizontally(f: Rect, w: number, h: number, kerf: number, rule: SplitRule): boolean {
  const rw = f.w - w - kerf
  const th = f.h - h - kerf
  switch (rule) {
    case 'rip':
      return true
    case 'cross':
      return false
    case 'sas':
      return f.w <= f.h
    case 'las':
      return f.w > f.h
    case 'slas':
      return rw <= th
    case 'llas':
      return rw > th
    case 'minas':
      return w * th > rw * h
    case 'maxas':
      return w * th <= rw * h
  }
}

/** Carve (w × h) out of the bottom-left of f; return the up-to-two remaining free rects. */
function split(f: Rect, w: number, h: number, kerf: number, horizontal: boolean): Rect[] {
  const rw = f.w - w - kerf
  const th = f.h - h - kerf
  const right: Rect = { x: f.x + w + kerf, y: f.y, w: rw, h: horizontal ? h : f.h }
  const top: Rect = { x: f.x, y: f.y + h + kerf, w: horizontal ? f.w : w, h: th }
  return [right, top].filter((r) => r.w > 0 && r.h > 0)
}

function fitsEmpty(p: NestPiece, usable: Rect): boolean {
  return orientations(p).some((o) => o.w <= usable.w && o.h <= usable.h)
}

function runHeuristic(pieces: NestPiece[], sheet: SheetSpec, fit: FitRule, splitRule: SplitRule): NestedSheet[] {
  const usable: Rect = {
    x: sheet.trim,
    y: sheet.trim,
    w: sheet.length - 2 * sheet.trim,
    h: sheet.width - 2 * sheet.trim,
  }
  const sheets: NestedSheet[] = []

  for (const p of pieces) {
    let best: { s: number; r: number; o: { w: number; h: number; rotated: boolean }; score: [number, number] } | null =
      null
    for (let s = 0; s < sheets.length; s++) {
      const free = sheets[s].freeRects
      for (let r = 0; r < free.length; r++) {
        for (const o of orientations(p)) {
          if (o.w > free[r].w || o.h > free[r].h) continue
          const score = fitScore(free[r], o.w, o.h, fit)
          if (!best || score[0] < best.score[0] || (score[0] === best.score[0] && score[1] < best.score[1])) {
            best = { s, r, o, score }
          }
        }
      }
    }
    if (!best) {
      sheets.push({ placements: [], usedArea: 0, freeRects: [{ ...usable }] })
      const s = sheets.length - 1
      // Score the orientation on the empty sheet too — taking the first one that fits
      // packs three 1250 × 750 panels per sheet as two.
      const fitting = orientations(p).filter((o) => o.w <= usable.w && o.h <= usable.h)
      const scored = fitting.map((o) => ({ o, score: fitScore(usable, o.w, o.h, fit) }))
      scored.sort((a, b) => a.score[0] - b.score[0] || a.score[1] - b.score[1])
      best = { s, r: 0, o: scored[0].o, score: scored[0].score }
    }
    const target = sheets[best.s]
    const f = target.freeRects[best.r]
    const { w, h, rotated } = best.o
    target.placements.push({ pieceId: p.id, label: p.label, x: f.x, y: f.y, w, h, rotated })
    target.usedArea += w * h
    const horizontal = splitHorizontally(f, w, h, sheet.kerf, splitRule)
    target.freeRects.splice(best.r, 1, ...split(f, w, h, sheet.kerf, horizontal))
  }
  return sheets
}

function better(a: NestedSheet[], b: NestedSheet[]): boolean {
  if (a.length !== b.length) return a.length < b.length
  if (a.length === 0) return false
  return a[a.length - 1].usedArea < b[b.length - 1].usedArea
}

export function nestSheets(pieces: NestPiece[], sheet: SheetSpec): NestResult {
  const usable: Rect = { x: 0, y: 0, w: sheet.length - 2 * sheet.trim, h: sheet.width - 2 * sheet.trim }
  const unplaced = pieces.filter((p) => !fitsEmpty(p, usable))
  const placeable = pieces.filter((p) => fitsEmpty(p, usable))

  let bestSheets: NestedSheet[] | null = null
  let bestName = ''
  for (const sort of SORTS) {
    const ordered = [...placeable].sort((a, b) => sortKey(b, sort) - sortKey(a, sort) || a.id.localeCompare(b.id))
    for (const fit of FITS) {
      for (const splitRule of SPLITS) {
        const result = runHeuristic(ordered, sheet, fit, splitRule)
        if (!bestSheets || better(result, bestSheets)) {
          bestSheets = result
          bestName = `${sort}/${fit}/${splitRule}`
        }
      }
    }
  }
  return { sheets: bestSheets ?? [], unplaced, heuristic: bestName }
}
