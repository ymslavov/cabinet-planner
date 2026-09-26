import { runChecks, type Warning } from './checks'
import { osbPieces, partCodes, timberPieces } from './cutlist'
import { cabinetHardware, hardwareTotals, type HardwareItem } from './hardware'
import { nestSheets, type NestPiece, type NestResult, type SheetSpec } from './nest'
import { cabinetParts } from './parts'
import { cabinetDims } from './sizing'
import { packTimber, type TimberResult } from './timber'
import type { CabinetDims, Part, PlanState } from './types'

export interface Budget {
  sheetsUsed: number
  /** Whole sheets before the last + the used fraction of the last, e.g. 6.4. */
  sheetsFraction: number
  sheetsStock: number
  timberNeeded: number
  timberBars: number
  timberStock: number
  timberStockKnown: boolean
  ok: boolean
}

export interface Derived {
  dims: Record<string, CabinetDims>
  parts: Record<string, Part[]>
  codes: Record<string, string>
  nest: NestResult
  timber: TimberResult
  budget: Budget
  warnings: Warning[]
  hardware: { byCabinet: Record<string, HardwareItem[]>; totals: HardwareItem[] }
}

// Nesting runs 288 heuristics — skip it when only positions changed (dragging).
let nestMemo: { key: string; result: NestResult } | null = null
function nestCached(pieces: NestPiece[], sheet: SheetSpec): NestResult {
  const key = JSON.stringify([pieces, sheet])
  if (nestMemo?.key !== key) nestMemo = { key, result: nestSheets(pieces, sheet) }
  return nestMemo.result
}

export function analyze(state: PlanState): Derived {
  const s = state.settings
  const dims: Record<string, CabinetDims> = {}
  const parts: Record<string, Part[]> = {}
  for (const c of state.cabinets) {
    const tool = state.tools.find((t) => t.id === c.toolId)
    dims[c.id] = cabinetDims(c, tool, s)
    parts[c.id] = cabinetParts(c, dims[c.id], s)
  }
  const codes = partCodes(state.cabinets, parts)
  const all = state.cabinets.flatMap((c) => parts[c.id])

  const nest = nestCached(osbPieces(all, codes, s.kerf), {
    length: s.sheet.length,
    width: s.sheet.width,
    kerf: s.kerf,
    trim: s.edgeTrim,
  })
  const timber = packTimber(timberPieces(all, codes), s.timber.stock, { kerf: s.kerf, defaultLength: s.timber.defaultLength })
  const warnings = runChecks(state, dims, parts, nest, timber)

  const sheetArea = s.sheet.length * s.sheet.width
  const last = nest.sheets[nest.sheets.length - 1]
  const budget: Budget = {
    sheetsUsed: nest.sheets.length,
    sheetsFraction: nest.sheets.length === 0 ? 0 : nest.sheets.length - 1 + last.usedArea / sheetArea,
    sheetsStock: s.sheet.count,
    timberNeeded: timber.totalLength,
    timberBars: timber.bars.length,
    timberStock: s.timber.stock.reduce((sum, b) => sum + b.length * b.qty, 0),
    timberStockKnown: timber.stockKnown,
    ok: !warnings.some((w) => w.level === 'error'),
  }
  const byCabinet: Record<string, HardwareItem[]> = {}
  for (const c of state.cabinets) byCabinet[c.id] = cabinetHardware(c, dims[c.id], parts[c.id], s)
  const hardware = { byCabinet, totals: hardwareTotals(state.cabinets.map((c) => byCabinet[c.id])) }
  return { dims, parts, codes, nest, timber, budget, warnings, hardware }
}
