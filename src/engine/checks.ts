import type { NestResult } from './nest'
import { shelfRange } from './parts'
import type { TimberResult } from './timber'
import type { Cabinet, CabinetDims, Fixture, Part, PlanState, Rotation, Tool } from './types'

export interface Warning {
  level: 'error' | 'warn' | 'info'
  /** Cabinet / fixture / tool the warning is about, for selection from the list. */
  objectId?: string
  message: string
  /** Machine-readable kind for warnings the 3D view draws (a red feed strip). */
  code?: 'feed-blocked'
}

/** A thing standing on the floor, reduced to what layout checks need. */
export interface Footprint {
  id: string
  name: string
  x: number
  z: number
  /** Extent along world X and Z after rotation. */
  sx: number
  sz: number
  /** Highest point above the floor. */
  top: number
}

const TOL = 0.5

export function rotatedSize(width: number, length: number, rotation: Rotation): [number, number] {
  return rotation === 90 || rotation === 270 ? [length, width] : [width, length]
}

function overlaps(a: Footprint, b: Footprint): boolean {
  return (
    Math.abs(a.x - b.x) < (a.sx + b.sx) / 2 - TOL &&
    Math.abs(a.z - b.z) < (a.sz + b.sz) / 2 - TOL
  )
}

export function footprints(state: PlanState, dims: Record<string, CabinetDims>): Footprint[] {
  const toolOf = (c: Cabinet) => state.tools.find((t) => t.id === c.toolId)
  const cabs = state.cabinets.map((c) => {
    const d = dims[c.id]
    const [sx, sz] = rotatedSize(d.width, d.length, c.rotation)
    const tool = toolOf(c)
    return { id: c.id, name: c.name, x: c.x, z: c.z, sx, sz, top: d.surfaceHeight + (tool ? tool.overallHeight : 0) }
  })
  const fixtures = state.fixtures.map((f: Fixture) => {
    const [sx, sz] = rotatedSize(f.width, f.length, f.rotation)
    return { id: f.id, name: f.name, x: f.x, z: f.z, sx, sz, top: f.height }
  })
  return [...cabs, ...fixtures]
}

/** The infeed + outfeed strip of a feed-axis tool, in world space. */
export function feedStrip(c: Cabinet, tool: Tool, d: CabinetDims, feedLength: number): Footprint | null {
  if (tool.feedAxis === 'none' || tool.exempt) return null
  // Feed axis in cabinet space, turned by the cabinet rotation.
  const alongX = (tool.feedAxis === 'x') !== (c.rotation === 90 || c.rotation === 270)
  const cabAlong = tool.feedAxis === 'x' ? d.width : d.length
  const across = tool.feedAxis === 'x' ? tool.baseLength : tool.baseWidth
  const along = cabAlong + 2 * feedLength
  return {
    id: `${c.id}:feed`,
    name: `${c.name} feed path`,
    x: c.x,
    z: c.z,
    sx: alongX ? along : across,
    sz: alongX ? across : along,
    top: d.deckTop ?? d.surfaceHeight,
  }
}

export function runChecks(
  state: PlanState,
  dims: Record<string, CabinetDims>,
  parts: Record<string, Part[]>,
  nest: NestResult,
  timber: TimberResult,
): Warning[] {
  const { settings: s } = state
  const out: Warning[] = []
  const add = (level: Warning['level'], message: string, objectId?: string, code?: Warning['code']) =>
    out.push({ level, message, objectId, code })

  // Per cabinet
  for (const c of state.cabinets) {
    const d = dims[c.id]
    const tool = state.tools.find((t) => t.id === c.toolId)
    if (c.toolId && !tool) add('warn', `${c.name}: its tool no longer exists`, c.id)
    if (d.carcassHeight <= 0) {
      add('error', `${c.name}: no room for a carcass (${fmt(d.carcassHeight)} mm) — the deck and casters already reach the surface`, c.id)
      continue
    }
    if ((parts[c.id] ?? []).length === 0) {
      add('error', `${c.name}: too small for its framing (carcass ${fmt(d.carcassHeight)} mm)`, c.id)
      continue
    }
    if (tool && !tool.exempt && d.deckTop !== null && Math.abs(d.deckTop - s.targetHeight) > TOL) {
      add('warn', `${c.name}: deck at ${fmt(d.deckTop)} mm, not on the ${s.targetHeight} mm plane`, c.id)
    }
    if (tool && (tool.baseWidth > d.width + TOL || tool.baseLength > d.length + TOL)) {
      add('warn', `${c.name}: ${tool.name} (${tool.baseWidth} × ${tool.baseLength}) overhangs the ${fmt(d.width)} × ${fmt(d.length)} top`, c.id)
    }
    const [lo, hi] = shelfRange(d, s, c.method)
    for (const h of c.shelves) {
      if (h < lo || h > hi) add('warn', `${c.name}: shelf at ${h} mm is outside ${fmt(lo)}–${fmt(hi)} and is left out`, c.id)
    }
    if (!c.hasBack) add('warn', `${c.name}: no back panel — the box will rack when rolled`, c.id)
    if (tool && !tool.measured) add('info', `MEASURE ${tool.name} before cutting — dimensions are estimates`, tool.id)
  }

  // Fixtures
  for (const f of state.fixtures) {
    if (Math.abs(f.height - s.targetHeight) > TOL) add('warn', `${f.name}: top at ${f.height} mm, not ${s.targetHeight}`, f.id)
    if (!f.measured) add('info', `MEASURE ${f.name} — size is a placeholder`, f.id)
  }

  // Layout
  const fps = footprints(state, dims)
  for (let i = 0; i < fps.length; i++)
    for (let j = i + 1; j < fps.length; j++)
      if (overlaps(fps[i], fps[j])) add('warn', `${fps[i].name} overlaps ${fps[j].name}`, fps[i].id)
  if (s.room.enabled) {
    for (const f of fps) {
      if (Math.abs(f.x) + f.sx / 2 > s.room.width / 2 + TOL || Math.abs(f.z) + f.sz / 2 > s.room.length / 2 + TOL)
        add('warn', `${f.name} is outside the room`, f.id)
    }
  }
  for (const c of state.cabinets) {
    const tool = state.tools.find((t) => t.id === c.toolId)
    if (!tool || dims[c.id].carcassHeight <= 0) continue
    const strip = feedStrip(c, tool, dims[c.id], s.feedLength)
    if (!strip) continue
    for (const f of fps) {
      if (f.id === c.id) continue
      if (overlaps(strip, f) && f.top > strip.top + TOL)
        add('warn', `${f.name} stands above the ${fmt(strip.top)} mm deck in ${c.name}'s feed path`, c.id, 'feed-blocked')
    }
  }

  // Stock
  if (nest.sheets.length > s.sheet.count)
    add('error', `Needs ${nest.sheets.length} sheets of OSB — you have ${s.sheet.count}`)
  for (const p of nest.unplaced) add('error', `${p.label} (${fmt(p.length)} × ${fmt(p.width)}) does not fit on a sheet`)
  if (timber.shortfall > 0) add('error', `Timber: ${timber.shortfall} more bar(s) needed than in stock`)
  for (const p of timber.oversize) add('error', `Timber ${p.label} (${fmt(p.length)} mm) is longer than any bar`)
  if (!timber.stockKnown && timber.bars.length > 0)
    add('info', `Timber stock not entered — the plan needs ${timber.bars.length} × ${s.timber.defaultLength} mm bars`)

  const order = { error: 0, warn: 1, info: 2 }
  return out.sort((a, b) => order[a.level] - order[b.level])
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
