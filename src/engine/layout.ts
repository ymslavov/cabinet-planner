import { rotatedSize } from './checks'
import { cabinetDims } from './sizing'
import type { Cabinet, Fixture, PlanState, Rotation } from './types'

/** Gap between a station and the wall, and between the saw and its outfeed tables. */
const GAP = 20

/**
 * The default shop layout (Y, 2026-09-26), computed from the real sizes so it can be re-applied
 * after anything is resized:
 *
 * - Table saw in the middle of the room, turned 90° so it feeds along the room's long axis
 *   (only the 8 m direction has room for a 2.5 m sheet each side), with the first two fixtures
 *   (the outfeed cabinets) butted up to it on either side of the feed line.
 * - Back long wall: mitre saw in the middle (its wings run along the wall), drill press at the
 *   left end, sander at the right end.
 * - Front long wall: planer (feeds along the wall) on the left, thicknesser turned 90° so it
 *   also feeds along the wall, on the right. They keep a full `feedLength` between them so
 *   neither stands in the other's feed path, and share what's left of the wall equally as
 *   run-out to the end walls (8 m room: 2.1 m each — an 8.76 m wall would be needed for 2.5 m
 *   everywhere, so for longer stock roll one out).
 *
 * Room: X = width (the long walls run along X), Z = depth, centred on the origin. Cabinets for
 * tools it doesn't know keep their position.
 */
export function arrangeDefault(state: PlanState): PlanState {
  const s = state.settings
  const W = s.room.width
  const L = s.room.length
  const size = (c: Cabinet, rotation: Rotation) => {
    const d = cabinetDims(c, state.tools.find((t) => t.id === c.toolId), s)
    const [sx, sz] = rotatedSize(d.width, d.length, rotation)
    return { sx, sz }
  }
  const backZ = (sz: number) => -(L / 2 - GAP - sz / 2)
  const frontZ = (sz: number) => L / 2 - GAP - sz / 2

  // Front wall: planer and thicknesser, a feed length apart, equal run-out to the end walls.
  const planer = state.cabinets.find((c) => c.toolId === 'hms850')
  const thick = state.cabinets.find((c) => c.toolId === '2012nb')
  const pw = planer ? size(planer, 180).sx : 0
  const tw = thick ? size(thick, 90).sx : 0
  const free = W - 2 * GAP - pw - tw
  const middle = Math.min(s.feedLength, free)
  const side = Math.max(0, (free - middle) / 2)
  const planerX = -W / 2 + GAP + side + pw / 2
  const thickX = W / 2 - GAP - side - tw / 2

  let sawHalf = 0
  const cabinets = state.cabinets.map((c): Cabinet => {
    const place = (x: number, z: number, rotation: Rotation): Cabinet => ({ ...c, x: Math.round(x), z: Math.round(z), rotation })
    switch (c.toolId) {
      case 'gts10': {
        sawHalf = size(c, 90).sx / 2
        return place(0, 0, 90)
      }
      case 'gcm8':
        return place(0, backZ(size(c, 0).sz), 0)
      case 'pbd40': {
        const { sx, sz } = size(c, 0)
        return place(-(W / 2 - GAP - sx / 2), backZ(sz), 0)
      }
      case 'bts700': {
        const { sx, sz } = size(c, 0)
        return place(W / 2 - GAP - sx / 2, backZ(sz), 0)
      }
      case 'hms850':
        return place(planerX, frontZ(size(c, 180).sz), 180)
      case '2012nb':
        return place(thickX, frontZ(size(c, 90).sz), 90)
      default:
        return c
    }
  })

  // Outfeed tables: longer side along the saw's feed, one each side, 20 mm from the saw.
  const fixtures = state.fixtures.map((f, i): Fixture => {
    if (i > 1) return f
    const rotation: Rotation = f.width >= f.length ? 0 : 90
    const [sx] = rotatedSize(f.width, f.length, rotation)
    const side = i === 0 ? -1 : 1
    return { ...f, x: Math.round(side * (sawHalf + GAP + sx / 2)), z: 0, rotation }
  })

  return { ...state, cabinets, fixtures, settings: { ...s, room: { ...s.room, enabled: true } } }
}
