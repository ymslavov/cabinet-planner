import { useState } from 'react'
import type { Derived } from '../engine/analyze'
import { cabinetLetter, partRows } from '../engine/cutlist'
import { USABLE_OFFCUT, type Cut, type NestedSheet } from '../engine/nest'
import type { TimberBar } from '../engine/timber'
import { usePlan } from '../store'

/** Light tints per cabinet so you can see whose parts are where on a sheet. */
const TINTS = ['#e9cf9c', '#bfd8c8', '#c9d3ea', '#efc4b4', '#dccbe6', '#d8e2a8', '#f1dca0', '#bfe0e4']
const tint = (i: number) => TINTS[i % TINTS.length]
const MIN_OFFCUT = 150

function SheetDiagram(props: {
  sheet: NestedSheet
  index: number
  length: number
  width: number
  codeCabinet: Record<string, number>
  labelOf: Record<string, string>
  hover: string | null
  setHover: (code: string | null) => void
  showCuts: boolean
}) {
  const { sheet, index, length, width, codeCabinet, labelOf, hover, setHover, showCuts } = props
  const [activeCut, setActiveCut] = useState<number | null>(null)
  const used = sheet.usedArea / (length * width)
  const offcuts = sheet.freeRects.filter((r) => r.w >= MIN_OFFCUT && r.h >= MIN_OFFCUT)
  return (
    <figure className="sheet">
      <figcaption>
        <strong>Sheet {index + 1}</strong>
        <span>
          {sheet.placements.length} pieces, {Math.round(used * 100)}% used, {sheet.cuts.length} cuts
        </span>
      </figcaption>
      <svg viewBox={`-40 -40 ${length + 80} ${width + 120}`} role="img" aria-label={`Sheet ${index + 1} cutting diagram`}>
        <defs>
          <pattern id="waste" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="40" height="40" fill="#eef0ed" />
            <line x1="0" y1="0" x2="0" y2="40" stroke="#cfd4d0" strokeWidth="8" />
          </pattern>
        </defs>
        <rect x={0} y={0} width={length} height={width} fill="url(#waste)" stroke="#1f2428" strokeWidth={4} />
        {offcuts.map((r, i) => (
          <text key={i} x={r.x + r.w / 2} y={r.y + r.h / 2} className="offcut" textAnchor="middle" dominantBaseline="middle">
            {Math.round(r.w)} × {Math.round(r.h)}
          </text>
        ))}
        {sheet.placements.map((p) => {
          const code = p.label
          const cab = codeCabinet[code] ?? 0
          const active = hover === code
          const big = p.w > 260 && p.h > 110
          const vertical = p.h > p.w * 1.8
          const fontSize = Math.max(22, Math.min(56, Math.min(p.w, p.h) * 0.42))
          return (
            <g key={p.pieceId} onMouseEnter={() => setHover(code)} onMouseLeave={() => setHover(null)}>
              <title>
                {code} {labelOf[code]} — {Math.round(p.rotated ? p.h : p.w)} × {Math.round(p.rotated ? p.w : p.h)} mm
                {p.rotated ? ' (turned on the sheet)' : ''}
              </title>
              <rect
                x={p.x}
                y={p.y}
                width={p.w}
                height={p.h}
                fill={active ? '#f5b800' : tint(cab)}
                stroke="#1f2428"
                strokeWidth={active ? 5 : 2.5}
              />
              {big ? (
                <>
                  <text x={p.x + p.w / 2} y={p.y + p.h / 2 - fontSize * 0.35} className="code" fontSize={fontSize} textAnchor="middle">
                    {code}
                  </text>
                  <text x={p.x + p.w / 2} y={p.y + p.h / 2 + fontSize * 0.75} className="dims" fontSize={fontSize * 0.62} textAnchor="middle">
                    {Math.round(p.w)} × {Math.round(p.h)}
                  </text>
                </>
              ) : (
                <text
                  x={p.x + p.w / 2}
                  y={p.y + p.h / 2}
                  className="code"
                  fontSize={fontSize}
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={vertical ? `rotate(-90 ${p.x + p.w / 2} ${p.y + p.h / 2})` : undefined}
                >
                  {code}
                </text>
              )}
            </g>
          )
        })}
        {showCuts &&
          sheet.cuts.map((c) => (
            <CutLine key={c.n} cut={c} active={activeCut === c.n} onHover={setActiveCut} />
          ))}
        {/* Sheet dimensions and the strong axis */}
        <text x={length / 2} y={width + 60} className="axis" textAnchor="middle">
          {length} mm, strong axis ⟶
        </text>
        <text x={-16} y={width / 2} className="axis" textAnchor="middle" transform={`rotate(-90 -16 ${width / 2})`}>
          {width}
        </text>
      </svg>
      {sheet.cuts.length > 0 && (
        <details className="cut-list">
          <summary>Cut order ({sheet.cuts.length} cuts)</summary>
          <ol>
            {sheet.cuts.map((c) => (
              <li key={c.n} onMouseEnter={() => setActiveCut(c.n)} onMouseLeave={() => setActiveCut(null)} data-active={activeCut === c.n}>
                <b>{c.kind === 'rip' ? 'Rip' : 'Crosscut'}</b> the {Math.round(c.region.w)} × {Math.round(c.region.h)} piece{' '}
                {Math.round(c.offset)} mm from its {c.kind === 'rip' ? 'bottom' : 'left'} edge
                <small> ({(c.length / 1000).toFixed(2)} m cut)</small>
              </li>
            ))}
          </ol>
        </details>
      )}
    </figure>
  )
}

/** One cut on the diagram: a dashed line with its number in a circle at the start. */
function CutLine({ cut, active, onHover }: { cut: Cut; active: boolean; onHover: (n: number | null) => void }) {
  const r = 34
  const cx = cut.kind === 'rip' ? cut.x1 + r + 6 : cut.x1
  const cy = cut.kind === 'rip' ? cut.y1 : cut.y1 + r + 6
  return (
    <g className={`cut-line${active ? ' active' : ''}`} onMouseEnter={() => onHover(cut.n)} onMouseLeave={() => onHover(null)}>
      <line x1={cut.x1} y1={cut.y1} x2={cut.x2} y2={cut.y2} />
      <circle cx={cx} cy={cy} r={r} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
        {cut.n}
      </text>
    </g>
  )
}

function TimberBars({ bars, scale, labelOf }: { bars: TimberBar[]; scale: number; labelOf: Record<string, string> }) {
  return (
    <div className="bars">
      {bars.map((b, i) => (
        <div className="bar-row" key={i}>
          <span className="bar-name">
            Bar {i + 1}
            <small>
              {b.stockLength} mm{b.fromStock ? '' : ', to buy'}
            </small>
          </span>
          <div className="bar-track" style={{ width: `${(b.stockLength / scale) * 100}%` }}>
            {b.cuts.map((c) => (
              <div
                key={c.pieceId}
                className="cut"
                style={{ left: `${(c.offset / b.stockLength) * 100}%`, width: `${(c.length / b.stockLength) * 100}%` }}
                title={`${c.label} ${labelOf[c.label] ?? ''} — ${Math.round(c.length)} mm`}
              >
                <b>{c.label}</b> {Math.round(c.length)}
              </div>
            ))}
            {b.offcut >= 200 && <span className="left">{Math.round(b.offcut)} left</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function CutPlan({ derived }: { derived: Derived }) {
  const cabinets = usePlan((s) => s.cabinets)
  const settings = usePlan((s) => s.settings)
  const [hover, setHover] = useState<string | null>(null)
  const [showCuts, setShowCuts] = useState(true)
  const { nest, timber, codes } = derived
  const st = nest.stats

  // code → cabinet index, code → part label
  const codeCabinet: Record<string, number> = {}
  const labelOf: Record<string, string> = {}
  cabinets.forEach((c, i) => {
    for (const p of derived.parts[c.id] ?? []) {
      codeCabinet[codes[p.id]] = i
      labelOf[codes[p.id]] = `${p.label}, ${c.name}`
    }
  })
  const pieceCount = nest.sheets.reduce((n, s) => n + s.placements.length, 0)
  const maxBar = Math.max(settings.timber.defaultLength, ...timber.bars.map((b) => b.stockLength))

  return (
    <div className="cutplan">
      <section className="cp-section">
        <header className="cp-head">
          <h2>OSB sheets</h2>
          <p>
            {pieceCount} pieces nested on {nest.sheets.length} of your {settings.sheet.count} sheets ({settings.sheet.length} × {settings.sheet.width} ×{' '}
            {settings.sheet.thickness} mm), allowing {settings.kerf} mm per saw cut
            {settings.edgeTrim > 0 ? ` and ${settings.edgeTrim} mm trimmed off each edge first` : ''}. Every layout is cut with straight, edge-to-edge
            track-saw cuts in the numbered order. The plan uses the fewest sheets, then the fewest (so longest) cuts, and keeps the waste together
            as big offcuts.
          </p>
          {st.cuts > 0 && (
            <dl className="cp-stats">
              <div>
                <dt>Cuts</dt>
                <dd>
                  {st.cuts}, averaging {(st.cutLength / st.cuts / 1000).toFixed(2)} m
                </dd>
              </div>
              <div>
                <dt>Largest offcut</dt>
                <dd>{st.largestOffcut ? `${Math.round(st.largestOffcut.w)} × ${Math.round(st.largestOffcut.h)}` : 'none'}</dd>
              </div>
              <div>
                <dt>Waste in usable offcuts</dt>
                <dd>
                  {st.wasteArea > 0 ? Math.round((100 * st.usableOffcutArea) / st.wasteArea) : 0}% (at least {USABLE_OFFCUT} mm wide)
                </dd>
              </div>
            </dl>
          )}
          <label className="check" style={{ marginBottom: 12 }}>
            <input type="checkbox" checked={showCuts} onChange={(e) => setShowCuts(e.target.checked)} />
            Show numbered cuts on the diagrams
          </label>
          <div className="cab-legend">
            {cabinets.map((c, i) => (
              <span key={c.id}>
                <i style={{ background: tint(i) }} />
                {cabinetLetter(i)} {c.name}
              </span>
            ))}
          </div>
        </header>
        {nest.unplaced.length > 0 && (
          <p className="cp-error">
            These parts are bigger than a sheet and are not in the plan:{' '}
            {nest.unplaced.map((p) => `${p.label} (${Math.round(p.length)} × ${Math.round(p.width)})`).join(', ')}.
          </p>
        )}
        {nest.sheets.length > settings.sheet.count && (
          <p className="cp-error">
            This design needs {nest.sheets.length} sheets and you have {settings.sheet.count}.
          </p>
        )}
        <div className="sheets">
          {nest.sheets.map((s, i) => (
            <SheetDiagram
              key={i}
              sheet={s}
              index={i}
              length={settings.sheet.length}
              width={settings.sheet.width}
              codeCabinet={codeCabinet}
              labelOf={labelOf}
              hover={hover}
              setHover={setHover}
              showCuts={showCuts}
            />
          ))}
          {nest.sheets.length === 0 && <p className="hint">No OSB parts yet. Add a cabinet to start.</p>}
        </div>
      </section>

      <section className="cp-section">
        <header className="cp-head">
          <h2>Timber, {settings.timber.a} × {settings.timber.b}</h2>
          <p>
            {timber.bars.length === 0
              ? 'No timber in this design.'
              : `${(timber.totalLength / 1000).toFixed(1)} m of cuts on ${timber.bars.length} bars. ` +
                (timber.stockKnown
                  ? timber.shortfall > 0
                    ? `Your stock runs out: ${timber.shortfall} more bar${timber.shortfall > 1 ? 's' : ''} of ${settings.timber.defaultLength} mm needed.`
                    : 'All from your stock.'
                  : `Your stock isn't counted yet, so this assumes ${settings.timber.defaultLength} mm bars. Enter the lengths you have under Shop settings and stock.`)}
          </p>
        </header>
        {timber.oversize.length > 0 && (
          <p className="cp-error">Longer than any bar: {timber.oversize.map((p) => `${p.label} (${Math.round(p.length)})`).join(', ')}.</p>
        )}
        <TimberBars bars={timber.bars} scale={maxBar} labelOf={labelOf} />
      </section>

      <section className="cp-section">
        <header className="cp-head">
          <h2>Hardware to buy</h2>
          <p>
            For all cabinets. The shim stacks are what set each deck to the outfeed height: slotted packers slide in around the tool's bolts
            once they are loosened.
          </p>
        </header>
        {derived.hardware.totals.length === 0 ? (
          <p className="hint">Nothing yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="parts">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Size and use</th>
                  <th className="num">Qty</th>
                </tr>
              </thead>
              <tbody>
                {derived.hardware.totals.map((h) => (
                  <tr key={`${h.key}|${h.spec}`}>
                    <td>{h.item}</td>
                    <td>{h.spec}</td>
                    <td className="num">{h.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="cp-section">
        <header className="cp-head">
          <h2>Parts by cabinet</h2>
          <p>Codes match the diagrams. Laminated OSB cleats are listed as strips: glue that many face to face per cleat.</p>
        </header>
        {cabinets.map((c, i) => {
          const rows = partRows(derived.parts[c.id] ?? [], codes)
          return (
            <div className="parts-block" key={c.id}>
              <h3>
                <span className="tag-inline" style={{ background: tint(i) }}>
                  {cabinetLetter(i)}
                </span>{' '}
                {c.name}
              </h3>
              {rows.length === 0 ? (
                <p className="cp-error">This cabinet can't be built as configured — see Checks.</p>
              ) : (
                <div className="table-wrap">
                  <table className="parts">
                    <thead>
                      <tr>
                        <th>Codes</th>
                        <th>Part</th>
                        <th>Material</th>
                        <th className="num">Length</th>
                        <th className="num">Width</th>
                        <th className="num">Thick</th>
                        <th className="num">Pieces</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, k) => (
                        <tr key={k} onMouseEnter={() => setHover(r.codes[0])} onMouseLeave={() => setHover(null)}>
                          <td className="codes">{r.codes.join(' ')}</td>
                          <td>
                            {r.label}
                            {r.laminations > 1 && <small> ({r.laminations} strips per cleat)</small>}
                            {r.grainLocked && <small> (along the strong axis)</small>}
                          </td>
                          <td>{r.material === 'osb' ? 'OSB' : 'Timber'}</td>
                          <td className="num">{Math.round(r.length * 10) / 10}</td>
                          <td className="num">{Math.round(r.width * 10) / 10}</td>
                          <td className="num">{Math.round(r.thickness * 10) / 10}</td>
                          <td className="num">{r.pieces}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </section>
    </div>
  )
}
