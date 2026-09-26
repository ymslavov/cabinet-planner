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

/** OSB pieces to nest: one per panel, `laminations` identical strips per laminated cleat. */
export function osbPieces(parts: Part[], codes: Record<string, string>): NestPiece[] {
  return parts
    .filter((p) => p.material === 'osb')
    .flatMap((p) =>
      Array.from({ length: p.cut.laminations }, (_, k) => ({
        id: p.cut.laminations > 1 ? `${p.id}#${k + 1}` : p.id,
        label: codes[p.id] ?? p.label,
        length: p.cut.length,
        width: p.cut.width,
        canRotate: !p.grainLocked,
      })),
    )
}

export function timberPieces(parts: Part[], codes: Record<string, string>): TimberPiece[] {
  return parts
    .filter((p) => p.material === 'timber')
    .map((p) => ({ id: p.id, label: codes[p.id] ?? p.label, length: p.cut.length }))
}

export interface PartRow {
  codes: string[]
  label: string
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
