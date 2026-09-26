import type { Cabinet, CabinetDims, Settings, Tool } from './types'

/** Footprint used when a cabinet has no tool and no size override. */
export const TOOLLESS_SIZE = 600

/**
 * Outside dimensions of a cabinet, from the spreadsheet's formulas:
 *   width/length = tool base + 2 × clearance
 *   surface      = target − deck height   (exempt tools: their typed surface height)
 *   carcass      = surface − caster − top thickness
 * Overrides replace the computed value. A non-positive carcass is returned as-is; the
 * checks report it and the part generator produces nothing for it.
 */
export function cabinetDims(cab: Cabinet, tool: Tool | undefined, s: Settings): CabinetDims {
  const t = s.sheet.thickness
  const topThickness = s.topLayers * t
  const computedSurface = !tool
    ? s.targetHeight
    : tool.exempt
      ? tool.fixedSurfaceHeight
      : s.targetHeight - tool.deckHeight
  const width = cab.overrides.width ?? (tool ? tool.baseWidth + 2 * s.clearance : TOOLLESS_SIZE)
  const length = cab.overrides.length ?? (tool ? tool.baseLength + 2 * s.clearance : TOOLLESS_SIZE)
  const surfaceHeight = cab.overrides.surfaceHeight ?? computedSurface
  return {
    width,
    length,
    surfaceHeight,
    topThickness,
    carcassHeight: surfaceHeight - cab.casterHeight - topThickness,
    casterHeight: cab.casterHeight,
    t,
    deckTop: tool ? surfaceHeight + tool.deckHeight : null,
  }
}
