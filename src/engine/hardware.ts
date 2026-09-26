import type { Cabinet, CabinetDims, Part, Settings } from './types'

/** Something to buy rather than cut. `key` groups identical items across cabinets. */
export interface HardwareItem {
  key: string
  item: string
  spec: string
  qty: number
}

const roundUp10 = (n: number) => Math.ceil(n / 10) * 10

/**
 * Casters, their bolts, and the levelling-foot kit. Rod length covers the block, the bottom
 * panel, ~30 mm of nuts inside, and the longest stretch below the block at full travel.
 */
export function cabinetHardware(_cab: Cabinet, dims: CabinetDims, parts: Part[], s: Settings): HardwareItem[] {
  if (parts.length === 0) return []
  const items: HardwareItem[] = [
    { key: 'caster', item: 'Swivel caster, braked', spec: `${dims.casterHeight} mm overall incl. plate`, qty: 4 },
    { key: 'caster-bolt', item: 'Caster bolt', spec: `M8 × ${roundUp10(dims.t + 25)} + penny washer + nyloc nut`, qty: 16 },
  ]
  const feet = parts.filter((p) => p.role === 'foot')
  if (feet.length > 0) {
    const m = `M${s.leveler.rod}`
    const hb = feet[0].size[1]
    const below = dims.baseHeight + (s.leveler.travel - dims.lift) - hb
    const rod = roundUp10(hb + dims.t + 30 + below)
    const n = feet.length
    items.push(
      { key: 'rod', item: 'Levelling rod', spec: `${m} threaded rod, cut to ${rod} mm`, qty: n },
      { key: 'tnut', item: 'T-nut', spec: `${m} hammer-in, flange under the foot block`, qty: n },
      { key: 'nut', item: 'Hex nut', spec: `${m} (two locked together inside as the turning head, one lock nut under the T-nut)`, qty: 3 * n },
      { key: 'washer', item: 'Washer', spec: `${m}, under the turning head`, qty: n },
      { key: 'capnut', item: 'Dome nut + pad', spec: `${m} acorn nut with a stick-on rubber pad (the foot)`, qty: n },
    )
  }
  return items
}

/** Sum identical items (same key and spec) over several cabinets. */
export function hardwareTotals(lists: HardwareItem[][]): HardwareItem[] {
  const map = new Map<string, HardwareItem>()
  for (const list of lists)
    for (const h of list) {
      const k = `${h.key}|${h.spec}`
      const cur = map.get(k)
      if (cur) cur.qty += h.qty
      else map.set(k, { ...h })
    }
  return [...map.values()]
}
