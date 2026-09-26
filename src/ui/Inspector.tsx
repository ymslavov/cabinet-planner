import type { Derived } from '../engine/analyze'
import { cabinetLetter } from '../engine/cutlist'
import { shelfRange } from '../engine/parts'
import type { BuildMethod, Cabinet, Fixture, Settings, Tool, ToolShape } from '../engine/types'
import { planStore, usePlan } from '../store'
import { Check, ConfirmButton, NumberField, Segmented, SelectField, TextField } from './fields'

const METHODS: { value: BuildMethod; label: string }[] = [
  { value: 'osb-cleat', label: 'OSB cleats' },
  { value: 'timber-cleat', label: 'Timber cleats' },
  { value: 'timber-frame', label: 'Timber frame' },
]

const METHOD_HINT: Record<BuildMethod, string> = {
  'osb-cleat': 'Cleats laminated from three 60 mm OSB strips. No timber, more OSB.',
  'timber-cleat': '30 × 40 timber cleats at every panel joint.',
  'timber-frame': 'Timber cleats plus front posts and rails that stiffen the open front.',
}

const SHAPES: { value: ToolShape; label: string }[] = [
  { value: 'tableSaw', label: 'Table saw' },
  { value: 'thicknesser', label: 'Thicknesser' },
  { value: 'planer', label: 'Planer-thicknesser' },
  { value: 'sander', label: 'Belt & disc sander' },
  { value: 'mitreSaw', label: 'Mitre saw' },
  { value: 'drillPress', label: 'Drill press' },
  { value: 'generic', label: 'Plain box' },
]

const r = (n: number) => Math.round(n * 10) / 10

function Position({ kind, obj }: { kind: 'cabinet' | 'fixture'; obj: Cabinet | Fixture }) {
  const { move, rotate } = planStore.getState()
  return (
    <>
      <h3>Position on the floor</h3>
      <div className="field-grid three">
        <NumberField label="Left–right" value={obj.x} onChange={(x) => move(kind, obj.id, x, obj.z)} />
        <NumberField label="Back–front" value={obj.z} onChange={(z) => move(kind, obj.id, obj.x, z)} />
        <label className="field">
          <span>Turned</span>
          <button className="btn" onClick={() => rotate(kind, obj.id)} title="Turn 90° (R)">
            {obj.rotation}° ↻
          </button>
        </label>
      </div>
      <p className="hint">Drag it in the model to move it; press R to turn the selected object.</p>
    </>
  )
}

function CabinetPanel({ cab, derived }: { cab: Cabinet; derived: Derived }) {
  const tools = usePlan((s) => s.tools)
  const settings = usePlan((s) => s.settings)
  const index = usePlan((s) => s.cabinets.findIndex((c) => c.id === cab.id))
  const { updateCabinet, duplicateCabinet, removeCabinet } = planStore.getState()
  const d = derived.dims[cab.id]
  const parts = derived.parts[cab.id] ?? []
  const tool = tools.find((t) => t.id === cab.toolId)
  const up = (patch: Partial<Cabinet>) => updateCabinet(cab.id, patch)
  const override = (key: keyof Cabinet['overrides'], v: number | undefined) => {
    const next = { ...cab.overrides }
    if (v === undefined) delete next[key]
    else next[key] = v
    up({ overrides: next })
  }
  const [lo, hi] = shelfRange(d, settings, cab.method)

  const addShelf = () => {
    const points = [lo, ...cab.shelves.filter((h) => h >= lo && h <= hi).sort((a, b) => a - b), hi]
    let best = 0
    for (let i = 1; i < points.length; i++) if (points[i] - points[i - 1] > points[best + 1] - points[best]) best = i - 1
    const h = Math.round((points[best] + points[best + 1]) / 2 / 10) * 10
    up({ shelves: [...cab.shelves, h].sort((a, b) => a - b) })
  }

  const osb = parts.filter((p) => p.material === 'osb')
  const timber = parts.filter((p) => p.material === 'timber')
  const osbArea = osb.reduce((sum, p) => sum + p.cut.length * p.cut.width * p.cut.laminations, 0) / 1e6
  const timberLen = timber.reduce((sum, p) => sum + p.cut.length, 0) / 1000

  return (
    <>
      <section className="section">
        <h2>
          <span className="tag-inline">{cabinetLetter(index)}</span>
          <span className="grow">{cab.name}</span>
        </h2>
        <div className="field-grid">
          <TextField label="Name" value={cab.name} onChange={(name) => up({ name })} wide />
          <SelectField
            wide
            label="Tool on top"
            value={cab.toolId ?? ''}
            options={[{ value: '', label: 'No tool (plain cabinet)' }, ...tools.map((t) => ({ value: t.id, label: t.name }))]}
            onChange={(v) => up({ toolId: v || null })}
          />
        </div>
        <h3>Build method</h3>
        <Segmented value={cab.method} options={METHODS} onChange={(method) => up({ method })} />
        <p className="hint">{METHOD_HINT[cab.method]}</p>
      </section>

      <section className="section">
        <h2>Size</h2>
        <div className="field-grid three">
          <NumberField label="Width" value={cab.overrides.width} placeholderValue={d.width} onChange={(v) => override('width', v)} onClear={() => override('width', undefined)} min={100} />
          <NumberField label="Depth" value={cab.overrides.length} placeholderValue={d.length} onChange={(v) => override('length', v)} onClear={() => override('length', undefined)} min={100} />
          <NumberField
            label="Top at"
            value={cab.overrides.surfaceHeight}
            placeholderValue={d.surfaceHeight}
            onChange={(v) => override('surfaceHeight', v)}
            onClear={() => override('surfaceHeight', undefined)}
            min={50}
          />
          <NumberField label="Casters" value={cab.casterHeight} onChange={(casterHeight) => up({ casterHeight })} min={0} title="Wheel height including the mounting plate" />
        </div>
        <p className="hint">Empty fields follow the tool: base + {settings.clearance} mm each side, top at {settings.targetHeight} minus the deck height. Type a number to override.</p>
        <dl className="readout" style={{ marginTop: 10 }}>
          <dt>Carcass height</dt>
          <dd style={{ color: d.carcassHeight <= 0 ? 'var(--red)' : undefined }}>{r(d.carcassHeight)} mm</dd>
          <dt>Top ({settings.topLayers} layers)</dt>
          <dd>{r(d.topThickness)} mm</dd>
          {tool && (
            <>
              <dt>Tool deck lands at</dt>
              <dd>
                {r(d.deckTop!)} mm{tool.exempt ? ' (own height)' : ''}
              </dd>
            </>
          )}
        </dl>
      </section>

      <section className="section">
        <h2>
          <span className="grow">Shelves</span>
          <button className="btn small" onClick={addShelf} disabled={hi <= lo}>
            Add shelf
          </button>
        </h2>
        <div className="stock-rows">
          {cab.shelves.map((h, i) => (
            <div className="stock-row" key={i} style={{ gridTemplateColumns: '1fr auto' }}>
              <NumberField
                label={`Shelf ${i + 1}, top face above the floor inside`}
                value={h}
                onChange={(v) => up({ shelves: cab.shelves.map((x, j) => (j === i ? v : x)).sort((a, b) => a - b) })}
              />
              <button className="icon-btn" style={{ alignSelf: 'end', marginBottom: 4 }} onClick={() => up({ shelves: cab.shelves.filter((_, j) => j !== i) })} title="Remove shelf">
                ✕
              </button>
            </div>
          ))}
        </div>
        <p className="hint">
          {hi > lo ? `Shelves fit between ${r(lo)} and ${r(hi)} mm.` : 'This carcass is too short for a shelf.'}
        </p>
        <div style={{ marginTop: 10 }}>
          <Check label="Back panel (stops the box racking)" checked={cab.hasBack} onChange={(hasBack) => up({ hasBack })} />
        </div>
      </section>

      <section className="section">
        <Position kind="cabinet" obj={cab} />
      </section>

      <section className="section">
        <h2>Material</h2>
        <dl className="readout">
          <dt>OSB parts</dt>
          <dd>
            {osb.reduce((n, p) => n + p.cut.laminations, 0)} pieces, {osbArea.toFixed(2)} m²
          </dd>
          <dt>Timber parts</dt>
          <dd>
            {timber.length} pieces, {timberLen.toFixed(1)} m
          </dd>
        </dl>
        <div className="row-actions" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => duplicateCabinet(cab.id)}>
            Duplicate
          </button>
          <ConfirmButton label="Delete" confirmLabel="Delete this cabinet?" onConfirm={() => removeCabinet(cab.id)} />
        </div>
      </section>
    </>
  )
}

function FixturePanel({ fx }: { fx: Fixture }) {
  const { updateFixture, removeFixture } = planStore.getState()
  const up = (patch: Partial<Fixture>) => updateFixture(fx.id, patch)
  return (
    <>
      <section className="section">
        <h2>{fx.name}</h2>
        <p className="hint" style={{ marginTop: -4, marginBottom: 10 }}>
          Furniture you already have. It isn't built or cut, but it takes floor space and supports stock at its height.
        </p>
        <div className="field-grid three">
          <TextField label="Name" value={fx.name} onChange={(name) => up({ name })} wide />
          <NumberField label="Width" value={fx.width} onChange={(width) => up({ width })} min={50} />
          <NumberField label="Depth" value={fx.length} onChange={(length) => up({ length })} min={50} />
          <NumberField label="Top at" value={fx.height} onChange={(height) => up({ height })} min={50} />
        </div>
        <div style={{ marginTop: 10 }}>
          <Check label="Measured (not a placeholder)" checked={fx.measured} onChange={(measured) => up({ measured })} />
        </div>
      </section>
      <section className="section">
        <Position kind="fixture" obj={fx} />
        <div className="row-actions" style={{ marginTop: 12 }}>
          <ConfirmButton label="Delete" confirmLabel="Delete this furniture?" onConfirm={() => removeFixture(fx.id)} />
        </div>
      </section>
    </>
  )
}

function ToolPanel({ tool }: { tool: Tool }) {
  const { updateTool, removeTool, addCabinet } = planStore.getState()
  const usedBy = usePlan((s) => s.cabinets.filter((c) => c.toolId === tool.id).length)
  const up = (patch: Partial<Tool>) => updateTool(tool.id, patch)
  return (
    <>
      <section className="section">
        <h2>{tool.name}</h2>
        <div className="field-grid">
          <TextField label="Name" value={tool.name} onChange={(name) => up({ name })} wide />
          <SelectField label="Model shape" value={tool.shape} options={SHAPES} onChange={(shape) => up({ shape })} />
          <label className="field">
            <span>Colour</span>
            <div className="input-wrap">
              <input type="color" value={tool.color} onChange={(e) => up({ color: e.target.value })} style={{ height: 30, padding: 2 }} />
            </div>
          </label>
          <NumberField label="Base width" value={tool.baseWidth} onChange={(baseWidth) => up({ baseWidth })} min={10} />
          <NumberField label="Base depth" value={tool.baseLength} onChange={(baseLength) => up({ baseLength })} min={10} />
          <NumberField label="Deck above its base" value={tool.deckHeight} onChange={(deckHeight) => up({ deckHeight })} min={0} />
          <NumberField label="Overall height" value={tool.overallHeight} onChange={(overallHeight) => up({ overallHeight })} min={10} />
          <NumberField label="Weight" unit="kg" value={tool.weightKg} onChange={(weightKg) => up({ weightKg })} min={0} />
          <SelectField
            label="Stock travels"
            value={tool.feedAxis}
            options={[
              { value: 'z', label: 'Front to back' },
              { value: 'x', label: 'Left to right' },
              { value: 'none', label: 'Not along an axis' },
            ]}
            onChange={(feedAxis) => up({ feedAxis })}
          />
        </div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Check label="Measured (not estimates)" checked={tool.measured} onChange={(measured) => up({ measured })} />
          <Check label="Has its own height (not on the shared plane)" checked={tool.exempt} onChange={(exempt) => up({ exempt })} />
        </div>
        {tool.exempt && (
          <div className="field-grid" style={{ marginTop: 8 }}>
            <NumberField label="Cabinet top at" value={tool.fixedSurfaceHeight} onChange={(fixedSurfaceHeight) => up({ fixedSurfaceHeight })} min={50} />
          </div>
        )}
        <div className="field-grid" style={{ marginTop: 10 }}>
          <TextField label="Notes" value={tool.notes} onChange={(notes) => up({ notes })} wide multiline />
        </div>
      </section>
      <section className="section">
        <p className="hint" style={{ marginTop: 0 }}>
          {usedBy === 0 ? 'No cabinet carries this tool yet.' : `On ${usedBy} cabinet${usedBy > 1 ? 's' : ''}.`}
        </p>
        <div className="row-actions" style={{ marginTop: 8 }}>
          <button className="btn" onClick={() => addCabinet(tool.id)}>
            Build a cabinet for it
          </button>
          <ConfirmButton label="Delete" confirmLabel="Delete this tool?" onConfirm={() => removeTool(tool.id)} />
        </div>
      </section>
    </>
  )
}

function SettingsPanel() {
  const s = usePlan((st) => st.settings)
  const { updateSettings } = planStore.getState()
  const up = (patch: Partial<Settings>) => updateSettings(patch)
  const stock = s.timber.stock
  const setStock = (next: Settings['timber']['stock']) => up({ timber: { ...s.timber, stock: next } })
  return (
    <>
      <section className="section">
        <h2>Shared work plane</h2>
        <div className="field-grid">
          <NumberField label="Deck height from floor" value={s.targetHeight} onChange={(targetHeight) => up({ targetHeight })} min={200} />
          <NumberField label="Clearance each side" value={s.clearance} onChange={(clearance) => up({ clearance })} min={0} />
          <NumberField label="Infeed/outfeed length" value={s.feedLength} onChange={(feedLength) => up({ feedLength })} min={0} />
          <NumberField label="Top layers" unit="" value={s.topLayers} onChange={(topLayers) => up({ topLayers: Math.round(topLayers) })} min={1} max={4} />
        </div>
      </section>
      <section className="section">
        <h2>OSB sheets</h2>
        <div className="field-grid">
          <NumberField label="Length" value={s.sheet.length} onChange={(length) => up({ sheet: { ...s.sheet, length } })} min={100} />
          <NumberField label="Width" value={s.sheet.width} onChange={(width) => up({ sheet: { ...s.sheet, width } })} min={100} />
          <NumberField label="Measured thickness" value={s.sheet.thickness} onChange={(thickness) => up({ sheet: { ...s.sheet, thickness } })} min={3} step={0.1} />
          <NumberField label="Sheets on hand" unit="" value={s.sheet.count} onChange={(count) => up({ sheet: { ...s.sheet, count: Math.round(count) } })} min={0} />
          <NumberField label="Saw kerf" value={s.kerf} onChange={(kerf) => up({ kerf })} min={0} />
          <NumberField label="Edge trim" value={s.edgeTrim} onChange={(edgeTrim) => up({ edgeTrim })} min={0} />
        </div>
        <p className="hint">Nominal 15 mm OSB measures 14.5–15.5. Gauge a sheet and enter the real thickness before cutting.</p>
        <div style={{ marginTop: 10 }}>
          <Check label="Keep tops and shelves along the strong axis" checked={s.respectGrain} onChange={(respectGrain) => up({ respectGrain })} />
        </div>
        <h3>Laminated OSB cleats</h3>
        <div className="field-grid">
          <NumberField label="Strip width" value={s.osbCleat.width} onChange={(width) => up({ osbCleat: { ...s.osbCleat, width } })} min={20} />
          <NumberField label="Strips per cleat" unit="" value={s.osbCleat.laminations} onChange={(laminations) => up({ osbCleat: { ...s.osbCleat, laminations: Math.round(laminations) } })} min={1} max={5} />
        </div>
      </section>
      <section className="section">
        <h2>Timber</h2>
        <div className="field-grid three">
          <NumberField label="Thin side" value={s.timber.a} onChange={(a) => up({ timber: { ...s.timber, a } })} min={10} />
          <NumberField label="Wide side" value={s.timber.b} onChange={(b) => up({ timber: { ...s.timber, b } })} min={10} />
          <NumberField label="Bar to buy" value={s.timber.defaultLength} onChange={(defaultLength) => up({ timber: { ...s.timber, defaultLength } })} min={100} />
        </div>
        <h3>Lengths on hand</h3>
        <div className="stock-rows">
          {stock.length === 0 && <p className="hint" style={{ margin: 0 }}>Not counted yet. The cut plan lists bars of the length to buy.</p>}
          {stock.map((b, i) => (
            <div className="stock-row" key={i}>
              <NumberField label="Length" value={b.length} onChange={(length) => setStock(stock.map((x, j) => (j === i ? { ...x, length } : x)))} min={1} />
              <NumberField label="How many" unit="" value={b.qty} onChange={(qty) => setStock(stock.map((x, j) => (j === i ? { ...x, qty: Math.round(qty) } : x)))} min={0} />
              <button className="icon-btn" style={{ alignSelf: 'end', marginBottom: 4 }} onClick={() => setStock(stock.filter((_, j) => j !== i))} title="Remove">
                ✕
              </button>
            </div>
          ))}
        </div>
        <button className="btn small" style={{ marginTop: 8 }} onClick={() => setStock([...stock, { length: s.timber.defaultLength, qty: 1 }])}>
          Add a length
        </button>
      </section>
      <section className="section">
        <h2>Room</h2>
        <Check label="Show the room outline" checked={s.room.enabled} onChange={(enabled) => up({ room: { ...s.room, enabled } })} />
        {s.room.enabled && (
          <div className="field-grid" style={{ marginTop: 8 }}>
            <NumberField label="Width" value={s.room.width} onChange={(width) => up({ room: { ...s.room, width } })} min={500} />
            <NumberField label="Depth" value={s.room.length} onChange={(length) => up({ room: { ...s.room, length } })} min={500} />
          </div>
        )}
      </section>
    </>
  )
}

export function Inspector({ derived }: { derived: Derived }) {
  const selection = usePlan((s) => s.selection)
  const cab = usePlan((s) => (selection?.kind === 'cabinet' ? s.cabinets.find((c) => c.id === selection.id) : undefined))
  const fx = usePlan((s) => (selection?.kind === 'fixture' ? s.fixtures.find((f) => f.id === selection.id) : undefined))
  const tool = usePlan((s) => (selection?.kind === 'tool' ? s.tools.find((t) => t.id === selection.id) : undefined))

  return (
    <aside className="inspector">
      {cab && <CabinetPanel cab={cab} derived={derived} />}
      {fx && <FixturePanel fx={fx} />}
      {tool && <ToolPanel tool={tool} />}
      {selection?.kind === 'settings' && <SettingsPanel />}
      {!cab && !fx && !tool && selection?.kind !== 'settings' && (
        <section className="section">
          <h2>Nothing selected</h2>
          <p className="hint">Pick a cabinet, a piece of furniture or a tool in the list or in the model to edit it. Drag objects on the floor to move them; R turns the selected one.</p>
        </section>
      )}
    </aside>
  )
}

