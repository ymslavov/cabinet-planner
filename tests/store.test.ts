import { describe, expect, test } from 'vitest'
import { createPlanStore, memoryStorage, STORAGE_KEY } from '../src/store'

const fresh = () => createPlanStore(memoryStorage())

describe('plan store', () => {
  test('starts from the seed', () => {
    const st = fresh().getState()
    expect(st.cabinets).toHaveLength(5)
    expect(st.tools).toHaveLength(5)
    expect(st.fixtures).toHaveLength(2)
  })

  test('removing a tool leaves its cabinet tool-less instead of dangling', () => {
    const store = fresh()
    store.getState().removeTool('gts10')
    expect(store.getState().cabinets.find((c) => c.id === 'cab-gts10')!.toolId).toBeNull()
  })

  test('removing a cabinet clears the selection pointing at it', () => {
    const store = fresh()
    store.getState().select({ kind: 'cabinet', id: 'cab-gts10' })
    store.getState().removeCabinet('cab-gts10')
    expect(store.getState().selection).toBeNull()
  })

  test('addCabinet creates a unique id and selects it', () => {
    const store = fresh()
    const id = store.getState().addCabinet('bts700')
    const st = store.getState()
    expect(st.cabinets.filter((c) => c.id === id)).toHaveLength(1)
    expect(st.selection).toEqual({ kind: 'cabinet', id })
  })

  test('rotate steps through 90° increments', () => {
    const store = fresh()
    for (let i = 0; i < 5; i++) store.getState().rotate('cabinet', 'cab-gts10')
    expect(store.getState().cabinets.find((c) => c.id === 'cab-gts10')!.rotation).toBe(90)
  })

  test('export → import round-trips the plan', () => {
    const a = fresh()
    a.getState().updateCabinet('cab-gts10', { casterHeight: 125 })
    const json = a.getState().exportJson()
    const b = fresh()
    expect(b.getState().importJson(json)).toEqual({ ok: true })
    expect(b.getState().cabinets.find((c) => c.id === 'cab-gts10')!.casterHeight).toBe(125)
  })

  test('import rejects foreign or broken JSON and leaves the plan untouched', () => {
    const store = fresh()
    const before = store.getState().cabinets
    for (const bad of ['not json', '{}', JSON.stringify({ app: 'other', version: 1, state: {} }), JSON.stringify({ app: 'cabinet-planner', version: 99, state: {} })]) {
      const res = store.getState().importJson(bad)
      expect(res.ok).toBe(false)
    }
    expect(store.getState().cabinets).toBe(before)
  })

  test('corrupt localStorage falls back to the seed and keeps a backup', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: '{broken' })
    const store = createPlanStore(storage)
    await store.persist.rehydrate()
    expect(store.getState().cabinets).toHaveLength(5)
    expect(storage.getItem(`${STORAGE_KEY}.corrupt`)).toBe('{broken')
  })

  test('persisted state is restored, and new settings keys get defaults', async () => {
    const storage = memoryStorage()
    const a = createPlanStore(storage)
    a.getState().updateSettings({ kerf: 2.4 })
    // Simulate an older save that lacks a settings key.
    const saved = JSON.parse(storage.getItem(STORAGE_KEY)!)
    delete saved.state.settings.feedLength
    storage.setItem(STORAGE_KEY, JSON.stringify(saved))
    const b = createPlanStore(storage)
    await b.persist.rehydrate()
    expect(b.getState().settings.kerf).toBe(2.4)
    expect(b.getState().settings.feedLength).toBe(2500)
  })

  test('reset restores the seed', () => {
    const store = fresh()
    store.getState().removeCabinet('cab-gts10')
    store.getState().reset()
    expect(store.getState().cabinets).toHaveLength(5)
  })
})
