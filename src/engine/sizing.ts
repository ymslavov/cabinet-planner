import type { Cabinet, CabinetDims, Settings, Tool } from './types'

/** Footprint used when a cabinet has no tool and no size override. */
export const TOOLLESS_SIZE = 600

/**
 * Outside dimensions of a cabinet, from the spreadsheet's formulas:
 *   width/length = tool base + 2 × clearance
 *   surface      = target − deck height − shim allowance   (exempt tools: their typed height)
 *   carcass      = surface − caster − top thickness
 * A tool on the shared plane sits on a `shimAllowance` stack of slotted shims, so the top is
 * built that much low; taking shims out or doubling the stack trims the deck ±allowance to
 * meet the outfeed tables. The cabinet always stands on its casters.
 * Overrides replace the computed value. A non-positive carcass is returned as-is; the
 * checks report it and the part generator produces nothing for it.
 */
export function cabinetDims(cab: Cabinet, tool: Tool | undefined, s: Settings): CabinetDims {
  const t = s.sheet.thickness
  const topThickness = s.topLayers * t
  const shim = tool && !tool.exempt ? Math.max(0, s.shimAllowance) : 0
  const computedSurface = !tool
    ? s.targetHeight
    : tool.exempt
      ? tool.fixedSurfaceHeight
      : s.targetHeight - tool.deckHeight - shim
  const width = cab.overrides.width ?? (tool ? tool.baseWidth + 2 * s.clearance : TOOLLESS_SIZE)
  const length = cab.overrides.length ?? (tool ? tool.baseLength + 2 * s.clearance : TOOLLESS_SIZE)
  const surfaceHeight = cab.overrides.surfaceHeight ?? computedSurface
  const deckTop = tool ? surfaceHeight + shim + tool.deckHeight : null
  return {
    width,
    length,
    surfaceHeight,
    topThickness,
    carcassHeight: surfaceHeight - cab.casterHeight - topThickness,
    casterHeight: cab.casterHeight,
    shim,
    adjust: shim > 0 && deckTop !== null ? { min: deckTop - shim, max: deckTop + shim } : null,
    t,
    deckTop,
  }
}
