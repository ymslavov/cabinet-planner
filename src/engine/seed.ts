import type { Cabinet, Fixture, PlanState, Settings, Tool } from './types'

// Mirrors skill/references/workshop.md — change both together.

export function defaultSettings(): Settings {
  return {
    targetHeight: 900,
    clearance: 25,
    kerf: 3,
    sheet: { length: 2500, width: 1500, thickness: 15, count: 7 },
    edgeTrim: 0,
    respectGrain: false,
    timber: { a: 30, b: 40, defaultLength: 3000, stock: [] },
    osbCleat: { width: 60, laminations: 3 },
    topLayers: 2,
    feedLength: 2500,
    room: { enabled: false, width: 6000, length: 4000 },
  }
}

function seedTools(): Tool[] {
  return [
    {
      id: 'gts10',
      name: 'Bosch GTS 10 XC table saw',
      shape: 'tableSaw',
      baseWidth: 740,
      baseLength: 570,
      deckHeight: 340,
      overallHeight: 560,
      weightKg: 34,
      color: '#1b5c8f',
      feedAxis: 'z',
      exempt: false,
      fixedSurfaceHeight: 800,
      measured: false,
      notes: 'Heaviest unit — sheet suggests 125 mm braked casters. Manufacturer dimensions: measure before cutting.',
    },
    {
      id: '2012nb',
      name: 'Makita 2012NB thicknesser',
      shape: 'thicknesser',
      baseWidth: 480,
      baseLength: 370,
      deckHeight: 190,
      overallHeight: 480,
      weightKg: 28,
      color: '#0f8b8d',
      feedAxis: 'z',
      exempt: false,
      fixedSurfaceHeight: 800,
      measured: false,
      notes: 'Needs clear space fore and aft — park with the feed axis unobstructed.',
    },
    {
      id: 'bts700',
      name: 'Scheppach BTS 700 belt & disc sander',
      shape: 'sander',
      baseWidth: 480,
      baseLength: 390,
      deckHeight: 230,
      overallHeight: 380,
      weightKg: 19,
      color: '#2d3b4e',
      feedAxis: 'none',
      exempt: false,
      fixedSurfaceHeight: 800,
      measured: false,
      notes: 'Belt 100 × 914, disc 150. Dimensions are estimates. 75 mm casters are enough.',
    },
    {
      id: 'gcm8',
      name: 'Bosch GCM 8 SJL mitre saw',
      shape: 'mitreSaw',
      baseWidth: 560,
      baseLength: 430,
      deckHeight: 95,
      overallHeight: 470,
      weightKg: 17.3,
      color: '#1b5c8f',
      feedAxis: 'x',
      exempt: false,
      fixedSurfaceHeight: 800,
      measured: false,
      notes: 'Axial-Glide: no rear rails, can sit tight against a wall. Wants support wings left and right.',
    },
    {
      id: 'pbd40',
      name: 'Bosch PBD 40 drill press',
      shape: 'drillPress',
      baseWidth: 330,
      baseLength: 350,
      deckHeight: 250,
      overallHeight: 650,
      weightKg: 11.2,
      color: '#1f7a3a',
      feedAxis: 'none',
      exempt: true,
      fixedSurfaceHeight: 800,
      measured: true,
      notes: 'Exempt from the plane: table is adjustable. Bolt through the 30 mm base plate into the top. Top-heavy — keep casters locked.',
    },
  ]
}

function cabinet(id: string, toolId: string, x: number, z: number, shelf: number): Cabinet {
  return {
    id,
    name: id,
    toolId,
    method: 'timber-cleat',
    casterHeight: 100,
    shelves: [shelf],
    hasBack: true,
    overrides: {},
    x,
    z,
    rotation: 0,
  }
}

function seedCabinets(): Cabinet[] {
  return [
    { ...cabinet('cab-gcm8', 'gcm8', -2300, 0, 320), name: 'Mitre saw base' },
    { ...cabinet('cab-bts700', 'bts700', -1400, 0, 250), name: 'Sander base' },
    { ...cabinet('cab-gts10', 'gts10', -300, 0, 200), name: 'Table saw base' },
    { ...cabinet('cab-2012nb', '2012nb', 800, 0, 270), name: 'Thicknesser base' },
    { ...cabinet('cab-pbd40', 'pbd40', 1600, 0, 320), name: 'Drill press base' },
  ]
}

function seedFixtures(): Fixture[] {
  return [
    { id: 'fx-outfeed-1', name: 'Outfeed cabinet 1', width: 1000, length: 600, height: 900, x: -300, z: -660, rotation: 0, measured: false },
    { id: 'fx-outfeed-2', name: 'Outfeed cabinet 2', width: 1000, length: 600, height: 900, x: 800, z: -560, rotation: 0, measured: false },
  ]
}

export function seedState(): PlanState {
  return {
    settings: defaultSettings(),
    tools: seedTools(),
    cabinets: seedCabinets(),
    fixtures: seedFixtures(),
  }
}
