import type { Derived } from '../engine/analyze'
import { cabinetLetter } from '../engine/cutlist'
import { planStore, usePlan, type Selection } from '../store'

const isSel = (sel: Selection, kind: string, id?: string) =>
  !!sel && sel.kind === kind && (id === undefined || ('id' in sel && sel.id === id))

export function Sidebar({ derived }: { derived: Derived }) {
  const cabinets = usePlan((s) => s.cabinets)
  const fixtures = usePlan((s) => s.fixtures)
  const tools = usePlan((s) => s.tools)
  const selection = usePlan((s) => s.selection)
  const { select, addCabinet, addFixture, addTool } = planStore.getState()

  const selectById = (id?: string) => {
    if (!id) return
    if (cabinets.some((c) => c.id === id)) select({ kind: 'cabinet', id })
    else if (fixtures.some((f) => f.id === id)) select({ kind: 'fixture', id })
    else if (tools.some((t) => t.id === id)) select({ kind: 'tool', id })
  }

  return (
    <aside className="side">
      <section className="section">
        <h2>
          <span className="grow">Cabinets</span>
          <button className="btn small" onClick={() => addCabinet(null)}>
            Add
          </button>
        </h2>
        <ul className="list">
          {cabinets.map((c, i) => {
            const d = derived.dims[c.id]
            const tool = tools.find((t) => t.id === c.toolId)
            return (
              <li key={c.id}>
                <button className="item" aria-current={isSel(selection, 'cabinet', c.id)} onClick={() => select({ kind: 'cabinet', id: c.id })}>
                  <span className="tag">{cabinetLetter(i)}</span>
                  <span className="name">{c.name}</span>
                  <span className="sub">
                    {Math.round(d.width)} × {Math.round(d.length)}, top at {Math.round(d.surfaceHeight)}
                    {!tool && ', no tool'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="section">
        <h2>
          <span className="grow">Existing furniture</span>
          <button className="btn small" onClick={addFixture}>
            Add
          </button>
        </h2>
        <ul className="list">
          {fixtures.map((f) => (
            <li key={f.id}>
              <button className="item" aria-current={isSel(selection, 'fixture', f.id)} onClick={() => select({ kind: 'fixture', id: f.id })}>
                <span className="tag fixture" />
                <span className="name">{f.name}</span>
                <span className="sub">
                  {f.width} × {f.length}, top at {f.height}
                  {!f.measured && <span className="flag"> measure</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="section">
        <h2>
          <span className="grow">Tools</span>
          <button className="btn small" onClick={addTool}>
            Add
          </button>
        </h2>
        <ul className="list">
          {tools.map((t) => (
            <li key={t.id}>
              <button className="item" aria-current={isSel(selection, 'tool', t.id)} onClick={() => select({ kind: 'tool', id: t.id })}>
                <span className="tag tool" style={{ background: t.color }} />
                <span className="name">{t.name}</span>
                <span className="sub">
                  {t.baseWidth} × {t.baseLength}, deck {t.deckHeight}
                  {t.exempt && ', own height'}
                  {!t.measured && <span className="flag"> measure</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button
          className="btn"
          style={{ marginTop: 10, width: '100%' }}
          aria-pressed={isSel(selection, 'settings')}
          onClick={() => select({ kind: 'settings' })}
        >
          Shop settings and stock
        </button>
      </section>

      <section className="section">
        <h2>Checks</h2>
        <ul className="checks">
          {derived.warnings.length === 0 && <li className="empty">Everything lines up and fits the stock.</li>}
          {derived.warnings.map((w, i) => (
            <li key={i} className={w.level} data-clickable={!!w.objectId} onClick={() => selectById(w.objectId)}>
              {w.message}
            </li>
          ))}
        </ul>
      </section>
    </aside>
  )
}
