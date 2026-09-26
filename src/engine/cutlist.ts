import type { NestPiece } from './nest'
import type { TimberPiece } from './timber'
import type { Cabinet, Part } from './types'

/** Cabinet letter: A, B, … Z, AA, AB … */
export function cabinetLetter(index: number): string {
  let n = index
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

/** Short part codes (A1, A2, B1 …) numbered in part order per cabinet — used on diagrams. */
export function partCodes(cabinets: Cabinet[], parts: Record<string, Part[]>): Record<string, string> {
  const codes: Record<string, string> = {}
  cabinets.forEach((c, i) => {
    ;(parts[c.id] ?? []).forEach((p, j) => {
      codes[p.id] = `${cabinetLetter(i)}${j + 1}`
    })
  })
  return codes
}

/**
 * OSB pieces to nest: one per panel, `laminations` identical strips per laminated cleat.
 * Foot blocks are not cut one square at a time: each cabinet's blocks come from `layers`
 * sticks of block × (n·block + (n−1)·kerf) — glue the sticks into one stack, then crosscut it
 * into the n blocks. Fewer, longer cuts (Y's priority) and a cleaner glue-up.
 */
export function osbPieces(parts: Part[], codes: Record<string, string>, kerf: number): NestPiece[] {
  const out: NestPiece[] = []
  const feetByCabinet = new Map<string, Part[]>()
  for (const p of parts) {
    if (p.material !== 'osb') continue
    if (p.role === 'foot') {
      feetByCabinet.set(p.cabinetId, [...(feetByCabinet.get(p.cabinetId) ?? []), p])
      continue
    }
    for (let k = 0; k < p.cut.laminations; k++)
      out.push({
        id: p.cut.laminations > 1 ? `${p.id}#${k + 1}` : p.id,
        label: codes[p.id] ?? p.label,
        length: p.cut.length,
        width: p.cut.width,
        canRotate: !p.grainLocked,
      })
  }
  for (const [cabinetId, feet] of feetByCabinet) {
    const f = feet[0]
    const label = feet.length > 1 ? `${codes[f.id]}–${codes[feet[feet.length - 1].id]}` : codes[f.id]
    for (let k = 0; k < f.cut.laminations; k++)
      out.push({
        id: `${cabinetId}:foot-stick#${k + 1}`,
        label: label ?? 'feet',
        length: feet.length * f.cut.length + (feet.length - 1) * kerf,
        width: f.cut.width,
        canRotate: true,
      })
  }
  return out
}

export function timberPieces(parts: Part[], codes: Record<string, string>): TimberPiece[] {
  return parts
    .filter((p) => p.material === 'timber')
    .map((p) => ({ id: p.id, label: codes[p.id] ?? p.label, length: p.cut.length }))
}

export interface PartRow {
  codes: string[]
  label: string
  role: Part['role']
  material: 'osb' | 'timber'
  length: number
  width: number
  thickness: number
  /** Physical pieces to cut: qty × laminations. */
  pieces: number
  laminations: number
  grainLocked: boolean
}

/** Identical parts of one cabinet collapsed into rows, for the parts table. */
export function partRows(parts: Part[], codes: Record<string, string>): PartRow[] {
  const rows = new Map<string, PartRow>()
  for (const p of parts) {
    const base = p.label.replace(/\b(left|right|\d+)\b/gi, '').replace(/\s+/g, ' ').trim()
    const key = [base, p.material, p.cut.length, p.cut.width, p.cut.thickness, p.cut.laminations].join('|')
    const row = rows.get(key)
    if (row) {
      row.codes.push(codes[p.id])
      row.pieces += p.cut.laminations
    } else {
      rows.set(key, {
        codes: [codes[p.id]],
        label: base,
        role: p.role,
        material: p.material,
        length: p.cut.length,
        width: p.cut.width,
        thickness: p.cut.thickness,
        pieces: p.cut.laminations,
        laminations: p.cut.laminations,
        grainLocked: p.grainLocked,
      })
    }
  }
  return [...rows.values()]
}
