import { useStore } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { createStore } from 'zustand/vanilla'
import { seedState, defaultSettings } from './engine/seed'
import type { Cabinet, Fixture, PlanState, Rotation, Settings, Tool } from './engine/types'

export const STORAGE_KEY = 'cabinet-planner'
export const SCHEMA_VERSION = 1

export type Selection = { kind: 'cabinet' | 'fixture' | 'tool'; id: string } | { kind: 'settings' } | null

export interface ViewPrefs {
  tab: 'layout' | 'cut'
  xray: boolean
  explode: boolean
  topView: boolean
  showPlane: boolean
  showFeed: boolean
}

export interface PlanStore extends PlanState {
  selection: Selection
  view: ViewPrefs
  select: (sel: Selection) => void
  setView: (patch: Partial<ViewPrefs>) => void
  updateSettings: (patch: Partial<Settings>) => void
  addCabinet: (toolId?: string | null) => string
  updateCabinet: (id: string, patch: Partial<Cabinet>) => void
  duplicateCabinet: (id: string) => string | null
  removeCabinet: (id: string) => void
  addFixture: () => string
  updateFixture: (id: string, patch: Partial<Fixture>) => void
  removeFixture: (id: string) => void
  addTool: () => string
  updateTool: (id: string, patch: Partial<Tool>) => void
  removeTool: (id: string) => void
  move: (kind: 'cabinet' | 'fixture', id: string, x: number, z: number) => void
  rotate: (kind: 'cabinet' | 'fixture', id: string) => void
  reset: () => void
  exportJson: () => string
  importJson: (text: string) => { ok: true } | { ok: false; error: string }
}

const defaultView: ViewPrefs = { tab: 'layout', xray: false, explode: false, topView: false, showPlane: true, showFeed: true }

const newId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`

/** In-memory StateStorage — for tests, and as a fallback when localStorage is unavailable. */
export function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial }
  return {
    getItem: (k: string): string | null => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v
    },
    removeItem: (k: string) => {
      delete data[k]
    },
    dump: () => ({ ...data }),
  }
}

/**
 * Wraps storage so an unparseable save never white-screens the app: the bad string is
 * copied to `<key>.corrupt` and the app starts from the seed.
 */
function safeStorage(inner: StateStorage): StateStorage {
  return {
    getItem: (k) => {
      const raw = inner.getItem(k) as string | null
      if (raw == null) return null
      try {
        JSON.parse(raw)
        return raw
      } catch {
        inner.setItem(`${k}.corrupt`, raw)
        inner.removeItem(k)
        return null
      }
    },
    setItem: (k, v) => inner.setItem(k, v),
    removeItem: (k) => inner.removeItem(k),
  }
}

function isPlanState(x: unknown): x is PlanState {
  const s = x as PlanState
  return (
    !!s &&
    typeof s === 'object' &&
    typeof s.settings === 'object' &&
    Array.isArray(s.tools) &&
    Array.isArray(s.cabinets) &&
    Array.isArray(s.fixtures)
  )
}

/** Fill settings keys added after the save was written. */
function withDefaults(state: PlanState): PlanState {
  const d = defaultSettings()
  const s = state.settings ?? d
  return {
    ...state,
    settings: {
      ...d,
      ...s,
      sheet: { ...d.sheet, ...s.sheet },
      timber: { ...d.timber, ...s.timber },
      osbCleat: { ...d.osbCleat, ...s.osbCleat },
      room: { ...d.room, ...s.room },
    },
  }
}

/** Upgrade a saved state from an older schema. Add a case per version bump. */
function migrate(state: PlanState, fromVersion: number): PlanState {
  void fromVersion
  return withDefaults(state)
}

function nextFreeX(cabinets: Cabinet[], fixtures: Fixture[]): number {
  const xs = [...cabinets.map((c) => c.x), ...fixtures.map((f) => f.x)]
  return xs.length ? Math.max(...xs) + 1000 : 0
}

export function createPlanStore(storage: StateStorage) {
  return createStore<PlanStore>()(
    persist(
      (set, get) => ({
        ...seedState(),
        selection: null,
        view: defaultView,

        select: (selection) => set({ selection }),
        setView: (patch) => set((st) => ({ view: { ...st.view, ...patch } })),
        updateSettings: (patch) => set((st) => ({ settings: { ...st.settings, ...patch } })),

        addCabinet: (toolId = null) => {
          const id = newId('cab')
          const tool = get().tools.find((t) => t.id === toolId)
          const cab: Cabinet = {
            id,
            name: tool ? `${tool.name.split(' ').slice(0, 2).join(' ')} base` : 'New cabinet',
            toolId: tool ? tool.id : null,
            method: 'timber-cleat',
            casterHeight: 100,
            shelves: [200],
            hasBack: true,
            overrides: {},
            x: nextFreeX(get().cabinets, get().fixtures),
            z: 0,
            rotation: 0,
          }
          set((st) => ({ cabinets: [...st.cabinets, cab], selection: { kind: 'cabinet', id } }))
          return id
        },
        updateCabinet: (id, patch) =>
          set((st) => ({ cabinets: st.cabinets.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
        duplicateCabinet: (id) => {
          const src = get().cabinets.find((c) => c.id === id)
          if (!src) return null
          const copy: Cabinet = { ...src, id: newId('cab'), name: `${src.name} copy`, x: src.x + 400, z: src.z + 400 }
          set((st) => ({ cabinets: [...st.cabinets, copy], selection: { kind: 'cabinet', id: copy.id } }))
          return copy.id
        },
        removeCabinet: (id) =>
          set((st) => ({
            cabinets: st.cabinets.filter((c) => c.id !== id),
            selection: st.selection && 'id' in st.selection && st.selection.id === id ? null : st.selection,
          })),

        addFixture: () => {
          const id = newId('fx')
          const fx: Fixture = {
            id,
            name: 'New fixture',
            width: 1000,
            length: 600,
            height: get().settings.targetHeight,
            x: nextFreeX(get().cabinets, get().fixtures),
            z: 0,
            rotation: 0,
            measured: false,
          }
          set((st) => ({ fixtures: [...st.fixtures, fx], selection: { kind: 'fixture', id } }))
          return id
        },
        updateFixture: (id, patch) =>
          set((st) => ({ fixtures: st.fixtures.map((f) => (f.id === id ? { ...f, ...patch } : f)) })),
        removeFixture: (id) =>
          set((st) => ({
            fixtures: st.fixtures.filter((f) => f.id !== id),
            selection: st.selection && 'id' in st.selection && st.selection.id === id ? null : st.selection,
          })),

        addTool: () => {
          const id = newId('tool')
          const tool: Tool = {
            id,
            name: 'New tool',
            shape: 'generic',
            baseWidth: 500,
            baseLength: 400,
            deckHeight: 200,
            overallHeight: 400,
            weightKg: 10,
            color: '#5b6470',
            feedAxis: 'none',
            exempt: false,
            fixedSurfaceHeight: 800,
            measured: false,
            notes: '',
          }
          set((st) => ({ tools: [...st.tools, tool], selection: { kind: 'tool', id } }))
          return id
        },
        updateTool: (id, patch) => set((st) => ({ tools: st.tools.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
        removeTool: (id) =>
          set((st) => ({
            tools: st.tools.filter((t) => t.id !== id),
            cabinets: st.cabinets.map((c) => (c.toolId === id ? { ...c, toolId: null } : c)),
            selection: st.selection && 'id' in st.selection && st.selection.id === id ? null : st.selection,
          })),

        move: (kind, id, x, z) =>
          kind === 'cabinet' ? get().updateCabinet(id, { x, z }) : get().updateFixture(id, { x, z }),
        rotate: (kind, id) => {
          const list = kind === 'cabinet' ? get().cabinets : get().fixtures
          const cur = list.find((o) => o.id === id)
          if (!cur) return
          const rotation = ((cur.rotation + 90) % 360) as Rotation
          if (kind === 'cabinet') get().updateCabinet(id, { rotation })
          else get().updateFixture(id, { rotation })
        },

        reset: () => set({ ...seedState(), selection: null }),

        exportJson: () => {
          const { settings, tools, cabinets, fixtures } = get()
          return JSON.stringify(
            { app: 'cabinet-planner', version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), state: { settings, tools, cabinets, fixtures } },
            null,
            2,
          )
        },
        importJson: (text) => {
          let doc: { app?: string; version?: number; state?: unknown }
          try {
            doc = JSON.parse(text)
          } catch {
            return { ok: false, error: 'Not a JSON file' }
          }
          if (doc?.app !== 'cabinet-planner') return { ok: false, error: 'Not a Cabinet Planner export' }
          if (typeof doc.version !== 'number' || doc.version > SCHEMA_VERSION)
            return { ok: false, error: `Unsupported version ${doc.version} (this app reads up to ${SCHEMA_VERSION})` }
          if (!isPlanState(doc.state)) return { ok: false, error: 'File is missing settings, tools, cabinets or fixtures' }
          const state = migrate(doc.state, doc.version)
          set({ ...state, selection: null })
          return { ok: true }
        },
      }),
      {
        name: STORAGE_KEY,
        version: SCHEMA_VERSION,
        storage: createJSONStorage(() => safeStorage(storage)),
        partialize: (st) => ({ settings: st.settings, tools: st.tools, cabinets: st.cabinets, fixtures: st.fixtures, view: st.view }),
        migrate: (persisted, version) => {
          const p = persisted as PlanState & { view?: ViewPrefs }
          return (isPlanState(p) ? { ...migrate(p, version), view: p.view } : seedState()) as PlanStore
        },
        merge: (persisted, current) => {
          const p = persisted as Partial<PlanState> & { view?: ViewPrefs }
          const view = { ...defaultView, ...p?.view }
          if (!isPlanState(p)) return current
          return { ...current, ...withDefaults(p), view }
        },
      },
    ),
  )
}

function browserStorage(): StateStorage {
  try {
    const k = `${STORAGE_KEY}.probe`
    localStorage.setItem(k, '1')
    localStorage.removeItem(k)
    return localStorage
  } catch {
    return memoryStorage()
  }
}

export const planStore = createPlanStore(typeof window === 'undefined' ? memoryStorage() : browserStorage())

export function usePlan<T>(selector: (st: PlanStore) => T): T {
  return useStore(planStore, selector)
}
