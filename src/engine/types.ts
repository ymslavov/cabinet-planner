// Domain types. Millimetres everywhere. Axes: X = width, Y = up, Z = depth, +Z = front.

export type Vec3 = [number, number, number]
export type Rotation = 0 | 90 | 180 | 270

/** How the carcass is held together. See skill/references/construction.md. */
export type BuildMethod = 'osb-cleat' | 'timber-cleat' | 'timber-frame'

export type ToolShape = 'tableSaw' | 'thicknesser' | 'planer' | 'sander' | 'mitreSaw' | 'drillPress' | 'generic'

export interface StockLength {
  length: number
  qty: number
}

export interface Settings {
  /** Every non-exempt tool deck lands at this height above the floor. */
  targetHeight: number
  /** Gap between tool base and cabinet edge, each side. */
  clearance: number
  /** Saw blade kerf for nesting and timber cutting. */
  kerf: number
  /** thickness is the MEASURED sheet thickness — nominal 15 varies 14.5–15.5. */
  sheet: { length: number; width: number; thickness: number; count: number }
  /** Trimmed off every sheet edge before nesting (damaged factory edges). */
  edgeTrim: number
  /** Lock tops and shelves to the sheet's long (strong) axis. */
  respectGrain: boolean
  /** a × b is the timber section; stock is what Y has, empty = unknown. */
  timber: { a: number; b: number; defaultLength: number; stock: StockLength[] }
  /** Laminated OSB cleat: `laminations` strips of `width` glued face to face. */
  osbCleat: { width: number; laminations: number }
  topLayers: number
  /**
   * Tool cabinets are built this much low and the tool sits on a stack of slotted shims this
   * thick, so each deck can be trimmed ±shimAllowance to meet the outfeed tables.
   */
  shimAllowance: number
  /** Length of the infeed/outfeed strip drawn on each side of feed-axis tools. */
  feedLength: number
  room: { enabled: boolean; width: number; length: number }
}

export interface Tool {
  id: string
  name: string
  shape: ToolShape
  baseWidth: number
  baseLength: number
  /** Working surface height above the tool's own base. */
  deckHeight: number
  overallHeight: number
  weightKg: number
  color: string
  /** Direction stock travels across the tool, in cabinet space. */
  feedAxis: 'x' | 'z' | 'none'
  /** Exempt tools don't land on the target plane; they use fixedSurfaceHeight. */
  exempt: boolean
  fixedSurfaceHeight: number
  /** False while dimensions are estimates that must be measured before cutting. */
  measured: boolean
  notes: string
}

export interface CabinetOverrides {
  width?: number
  length?: number
  surfaceHeight?: number
}

export interface Cabinet {
  id: string
  name: string
  toolId: string | null
  method: BuildMethod
  casterHeight: number
  /** Height of each shelf's top face above the inside floor (top of the bottom panel). */
  shelves: number[]
  hasBack: boolean
  overrides: CabinetOverrides
  x: number
  z: number
  rotation: Rotation
}

/** Existing furniture that isn't built here — the outfeed cabinets. */
export interface Fixture {
  id: string
  name: string
  width: number
  length: number
  height: number
  x: number
  z: number
  rotation: Rotation
  measured: boolean
}

export interface PlanState {
  settings: Settings
  tools: Tool[]
  cabinets: Cabinet[]
  fixtures: Fixture[]
}

export interface CabinetDims {
  width: number
  length: number
  /** Top face of the cabinet top, from the floor. */
  surfaceHeight: number
  topThickness: number
  /** From the top of the casters to the underside of the top. */
  carcassHeight: number
  casterHeight: number
  /** Nominal shim stack under the tool (0 for exempt tools and plain cabinets). */
  shim: number
  /** Deck range from no shims to a double stack; null when not shimmed. */
  adjust: { min: number; max: number } | null
  /** Sheet thickness in use. */
  t: number
  /** Where the tool deck ends up; null when there is no tool. */
  deckTop: number | null
}

export type PartRole =
  | 'bottom'
  | 'side'
  | 'back'
  | 'top'
  | 'shelf'
  | 'cleat'
  | 'post'
  | 'rail'

export interface Part {
  id: string
  cabinetId: string
  label: string
  role: PartRole
  material: 'osb' | 'timber'
  /** Axis-aligned box in cabinet space: size and centre. Origin = footprint centre at floor. */
  size: Vec3
  center: Vec3
  /**
   * What to cut. OSB: `laminations` identical strips of length × width (1 for panels).
   * Timber: one piece of `length` in the settings' section.
   */
  cut: { length: number; width: number; thickness: number; laminations: number }
  /** Must keep its length along the sheet's strong axis when nested. */
  grainLocked: boolean
}
