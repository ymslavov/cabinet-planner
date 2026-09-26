/**
 * Guillotine sheet nesting for a track saw, with an explicit cut plan.
 *
 * Every placement is carved out of a free rectangle with up to two straight cuts that run the
 * full width or height of that rectangle, so the result is always cuttable edge to edge. Each
 * sheet keeps its cuts as a tree; afterwards cuts that only separate waste from waste are
 * dropped (the waste merges into one bigger offcut) and the rest are numbered in a valid order
 * (a region is always cut before the pieces inside it).
 *
 * Sheet space: x runs along the sheet length (the OSB strong axis), y along the width.
 * A **rip** is a cut along x (constant y); a **crosscut** runs along y (constant x).
 * A piece's `length` lies along x unless the placement is `rotated`.
 *
 * Choosing between layouts (Y's priorities, 2026-09-26):
 *   1. fewest sheets — material first;
 *   2. easiest to cut — fewest cuts, which for the same pieces means longer ones;
 *   3. waste gathered into big usable offcuts rather than slivers.
 * Steps 2 and 3 are one cost: cuts × (1 + 0.1 × share of the waste NOT in usable offcuts).
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

export interface Cut {
  /** 1-based order on its sheet. */
  n: number
  kind: 'rip' | 'cross'
  /** The cut line (the blade's near edge), sheet coordinates. */
  x1: number
  y1: number
  x2: number
  y2: number
  length: number
  /** The piece of sheet being cut, and where the line falls from its bottom/left edge. */
  region: Rect
  offset: number
}

export interface NestedSheet {
  placements: Placement[]
  usedArea: number
  /** Offcuts after merging — every leftover region that no cut separates. */
  freeRects: Rect[]
  cuts: Cut[]
}

export interface NestStats {
  cuts: number
  cutLength: number
  largestOffcut: Rect | null
  /** Area of offcuts at least USABLE_OFFCUT on their short side. */
  usableOffcutArea: number
  /** Everything on the used sheets that isn't a part (offcuts + kerf). */
  wasteArea: number
}

export interface NestResult {
  sheets: NestedSheet[]
  /** Pieces that don't fit an empty sheet in any allowed orientation. */
  unplaced: NestPiece[]
  heuristic: string
  stats: NestStats
}

/** An offcut is worth keeping when its short side is at least this. */
export const USABLE_OFFCUT = 300
/**
 * Fully consolidated waste is worth this share of extra cuts: a layout may take up to 10 %
 * more cuts if that turns all its slivers into usable offcuts.
 */
const OFFCUT_WEIGHT = 0.1

type SortRule = 'area' | 'long' | 'short' | 'perimeter'
type FitRule = 'baf' | 'bssf' | 'blsf'
type SplitRule = 'rip' | 'cross' | 'sas' | 'las' | 'slas' | 'llas' | 'minas' | 'maxas'
/** 'long-x' = long side along the sheet (strip layouts), 'long-y' = across, 'free' = either. */
type OrientRule = 'free' | 'long-x' | 'long-y'

const SORTS: SortRule[] = ['area', 'long', 'short', 'perimeter']
const FITS: FitRule[] = ['baf', 'bssf', 'blsf']
const SPLITS: SplitRule[] = ['rip', 'cross', 'sas', 'las', 'slas', 'llas', 'minas', 'maxas']
const ORIENTS: OrientRule[] = ['long-x', 'free', 'long-y']

interface Orientation {
  w: number
  h: number
  rotated: boolean
}

/** A node of a sheet's cut tree. Free leaves are mutated in place as pieces go in. */
interface TNode {
  kind: 'free' | 'piece' | 'split'
  rect: Rect
  placement?: Placement
  dir?: 'rip' | 'cross'
  /** Coordinate of the cut line (y for a rip, x for a crosscut). */
  at?: number
  a?: TNode
  b?: TNode | null
}

function orientations(p: NestPiece, rule: OrientRule, usable: Rect): Orientation[] {
  const natural = { w: p.length, h: p.width, rotated: false }
  if (!p.canRotate || p.length === p.width) return [natural]
  const turned = { w: p.width, h: p.length, rotated: true }
  if (rule === 'free') return [natural, turned]
  const [pref, other] = (rule === 'long-x') === p.length >= p.width ? [natural, turned] : [turned, natural]
  // Fall back to the other way only if the preferred way can't fit a sheet at all.
  return pref.w <= usable.w && pref.h <= usable.h ? [pref] : [other]
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

/** Rip first (the remainder above spans the full width) or crosscut first. */
function ripFirst(f: Rect, w: number, h: number, kerf: number, rule: SplitRule): boolean {
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

const freeNode = (rect: Rect): TNode | null => (rect.w > 0 && rect.h > 0 ? { kind: 'free', rect } : null)

/**
 * Put a piece in the bottom-left of free leaf `node`, turning the leaf into a subtree.
 * Returns the new free leaves. A cut is made whenever the piece doesn't reach the region's
 * edge — even if what's left is thinner than the kerf and just turns to dust.
 */
function carve(node: TNode, o: Orientation, pl: Placement, kerf: number, rip: boolean): TNode[] {
  const f = node.rect
  const out: TNode[] = []
  const piece: TNode = { kind: 'piece', rect: { x: f.x, y: f.y, w: o.w, h: o.h }, placement: pl }

  const cross = (region: Rect, into: TNode, inner: TNode): TNode => {
    // Crosscut at x = region.x + o.w, keeping `inner` on the left.
    if (region.w <= o.w) return inner
    const right = freeNode({ x: region.x + o.w + kerf, y: region.y, w: region.w - o.w - kerf, h: region.h })
    if (right) out.push(right)
    Object.assign(into, { kind: 'split', rect: region, dir: 'cross', at: region.x + o.w, a: inner, b: right })
    return into
  }
  const ripAt = (region: Rect, into: TNode, inner: TNode): TNode => {
    // Rip at y = region.y + o.h, keeping `inner` below.
    if (region.h <= o.h) return inner
    const top = freeNode({ x: region.x, y: region.y + o.h + kerf, w: region.w, h: region.h - o.h - kerf })
    if (top) out.push(top)
    Object.assign(into, { kind: 'split', rect: region, dir: 'rip', at: region.y + o.h, a: inner, b: top })
    return into
  }

  let root: TNode
  if (rip) {
    const band: Rect = { x: f.x, y: f.y, w: f.w, h: o.h }
    const bandNode = cross(band, { kind: 'free', rect: band }, piece)
    root = ripAt(f, { kind: 'free', rect: f }, bandNode)
  } else {
    const col: Rect = { x: f.x, y: f.y, w: o.w, h: f.h }
    const colNode = ripAt(col, { kind: 'free', rect: col }, piece)
    root = cross(f, { kind: 'free', rect: f }, colNode)
  }
  // Replace the leaf in place so its parent keeps pointing at it.
  for (const k of ['placement', 'dir', 'at', 'a', 'b'] as const) delete node[k]
  Object.assign(node, root)
  return out
}

interface Run {
  sheets: NestedSheet[]
  roots: TNode[]
}

/**
 * 'global': each piece (in sort order) goes to the best free rectangle on any open sheet.
 * 'sequential': one sheet at a time — keep placing the next piece that fits until nothing
 * else fits, then open the next sheet. Sheets come out full and the waste collects on the
 * last one as a single big offcut instead of a strip on every sheet.
 */
type FillRule = 'global' | 'sequential'
const FILLS: FillRule[] = ['sequential', 'global']

function runHeuristic(
  pieces: NestPiece[],
  sheet: SheetSpec,
  usable: Rect,
  fill: FillRule,
  orient: OrientRule,
  fit: FitRule,
  split: SplitRule,
): Run {
  const roots: TNode[] = []
  const free: TNode[][] = []
  const placements: Placement[][] = []

  const openSheet = () => {
    const root: TNode = { kind: 'free', rect: { ...usable } }
    roots.push(root)
    free.push([root])
    placements.push([])
    return roots.length - 1
  }
  /** Best spot for p on the given sheets, or null. */
  const bestSpot = (p: NestPiece, sheets: number[]) => {
    let best: { s: number; r: number; o: Orientation; score: [number, number] } | null = null
    for (const s of sheets)
      for (let r = 0; r < free[s].length; r++) {
        const f = free[s][r].rect
        for (const o of orientations(p, orient, usable)) {
          if (o.w > f.w || o.h > f.h) continue
          const score = fitScore(f, o.w, o.h, fit)
          if (!best || score[0] < best.score[0] || (score[0] === best.score[0] && score[1] < best.score[1])) best = { s, r, o, score }
        }
      }
    return best
  }
  const place = (p: NestPiece, spot: { s: number; r: number; o: Orientation }) => {
    const node = free[spot.s][spot.r]
    const f = node.rect
    const pl: Placement = { pieceId: p.id, label: p.label, x: f.x, y: f.y, w: spot.o.w, h: spot.o.h, rotated: spot.o.rotated }
    placements[spot.s].push(pl)
    const fresh = carve(node, spot.o, pl, sheet.kerf, ripFirst(f, spot.o.w, spot.o.h, sheet.kerf, split))
    free[spot.s].splice(spot.r, 1, ...fresh)
  }

  if (fill === 'global') {
    for (const p of pieces) {
      const spot = bestSpot(p, roots.map((_, i) => i)) ?? bestSpot(p, [openSheet()])!
      place(p, spot)
    }
  } else {
    let remaining = pieces
    while (remaining.length) {
      const s = openSheet()
      const left: NestPiece[] = []
      for (const p of remaining) {
        const spot = bestSpot(p, [s])
        if (spot) place(p, spot)
        else left.push(p)
      }
      remaining = left
    }
  }

  const sheets = roots.map((root, i) => finishSheet(root, placements[i]))
  return { sheets, roots }
}

/** Merge waste-only subtrees, then read off the cuts in order and the offcuts. */
function finishSheet(root: TNode, placements: Placement[]): NestedSheet {
  const hasPiece = (n: TNode): boolean => {
    if (n.kind === 'piece') return true
    if (n.kind === 'free') return false
    const a = hasPiece(n.a!)
    const b = n.b ? hasPiece(n.b) : false
    if (!a && !b) {
      // Nothing to cut out here: leave it as one offcut.
      for (const k of ['dir', 'at', 'a', 'b'] as const) delete n[k]
      n.kind = 'free'
    }
    return a || b
  }
  hasPiece(root)

  const cuts: Cut[] = []
  const freeRects: Rect[] = []
  const walk = (n: TNode) => {
    if (n.kind === 'free') {
      freeRects.push(n.rect)
      return
    }
    if (n.kind === 'piece') return
    const r = n.rect
    const at = n.at!
    cuts.push(
      n.dir === 'rip'
        ? { n: cuts.length + 1, kind: 'rip', x1: r.x, y1: at, x2: r.x + r.w, y2: at, length: r.w, region: r, offset: at - r.y }
        : { n: cuts.length + 1, kind: 'cross', x1: at, y1: r.y, x2: at, y2: r.y + r.h, length: r.h, region: r, offset: at - r.x },
    )
    walk(n.a!)
    if (n.b) walk(n.b)
  }
  walk(root)
  const usedArea = placements.reduce((sum, p) => sum + p.w * p.h, 0)
  return { placements, usedArea, freeRects, cuts }
}

function statsOf(sheets: NestedSheet[], usable: Rect): NestStats {
  let cuts = 0
  let cutLength = 0
  let largest: Rect | null = null
  let usableOffcutArea = 0
  let wasteArea = 0
  for (const s of sheets) {
    cuts += s.cuts.length
    cutLength += s.cuts.reduce((sum, c) => sum + c.length, 0)
    wasteArea += usable.w * usable.h - s.usedArea
    for (const r of s.freeRects) {
      if (!largest || r.w * r.h > largest.w * largest.h) largest = r
      if (Math.min(r.w, r.h) >= USABLE_OFFCUT) usableOffcutArea += r.w * r.h
    }
  }
  return { cuts, cutLength, largestOffcut: largest, usableOffcutArea, wasteArea }
}

function cost(st: NestStats): number {
  const scattered = st.wasteArea > 0 ? 1 - st.usableOffcutArea / st.wasteArea : 0
  return st.cuts * (1 + OFFCUT_WEIGHT * scattered)
}

function better(a: { sheets: NestedSheet[]; stats: NestStats }, b: { sheets: NestedSheet[]; stats: NestStats }): boolean {
  if (a.sheets.length !== b.sheets.length) return a.sheets.length < b.sheets.length
  const ca = cost(a.stats)
  const cb = cost(b.stats)
  if (Math.abs(ca - cb) > 1e-9) return ca < cb
  const la = a.stats.largestOffcut ? a.stats.largestOffcut.w * a.stats.largestOffcut.h : 0
  const lb = b.stats.largestOffcut ? b.stats.largestOffcut.w * b.stats.largestOffcut.h : 0
  if (la !== lb) return la > lb
  // Same number of cuts: longer ones are the easier ones.
  return a.stats.cutLength > b.stats.cutLength
}

export function nestSheets(pieces: NestPiece[], sheet: SheetSpec): NestResult {
  const usable: Rect = { x: sheet.trim, y: sheet.trim, w: sheet.length - 2 * sheet.trim, h: sheet.width - 2 * sheet.trim }
  const fits = (p: NestPiece) => orientations(p, 'free', usable).some((o) => o.w <= usable.w && o.h <= usable.h)
  const unplaced = pieces.filter((p) => !fits(p))
  const placeable = pieces.filter(fits)

  let best: { sheets: NestedSheet[]; stats: NestStats; name: string } | null = null
  for (const sort of SORTS) {
    const ordered = [...placeable].sort((a, b) => sortKey(b, sort) - sortKey(a, sort) || a.id.localeCompare(b.id))
    for (const fill of FILLS)
      for (const orient of ORIENTS)
        for (const fit of FITS)
          for (const split of SPLITS) {
            const { sheets } = runHeuristic(ordered, sheet, usable, fill, orient, fit, split)
            const cand = { sheets, stats: statsOf(sheets, usable), name: `${fill}/${sort}/${orient}/${fit}/${split}` }
            if (!best || better(cand, best)) best = cand
          }
  }
  if (!best) return { sheets: [], unplaced, heuristic: '', stats: statsOf([], usable) }
  return { sheets: best.sheets, unplaced, heuristic: best.name, stats: best.stats }
}
