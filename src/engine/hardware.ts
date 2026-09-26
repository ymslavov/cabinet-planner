import type { Cabinet, CabinetDims, Part, Settings } from './types'

/** Something to buy rather than cut. `key` groups identical items across cabinets. */
export interface HardwareItem {
  key: string
  item: string
  spec: string
  qty: number
}

const roundUp10 = (n: number) => Math.ceil(n / 10) * 10

/** Casters, their bolts, and the shim stacks a tool on the shared plane sits on. */
export function cabinetHardware(_cab: Cabinet, dims: CabinetDims, parts: Part[], s: Settings): HardwareItem[] {
  if (parts.length === 0) return []
  const items: HardwareItem[] = [
    { key: 'caster', item: 'Swivel caster, braked', spec: `${dims.casterHeight} mm overall incl. plate`, qty: 4 },
    { key: 'caster-bolt', item: 'Caster bolt', spec: `M8 × ${roundUp10(dims.t + 25)} + penny washer + nyloc nut`, qty: 16 },
  ]
  if (dims.shim > 0)
    items.push({
      key: 'shims',
      item: 'Shim stack',
      spec: `slotted (horseshoe) packers, 1/2/3/5 mm, stacked to ${s.shimAllowance} mm under each corner of the tool`,
      qty: 4,
    })
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
