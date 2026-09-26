import { useRef, useState } from 'react'
import type { Derived } from '../engine/analyze'
import { planStore, usePlan } from '../store'
import { ConfirmButton } from './fields'

const m = (mm: number) => (mm / 1000).toFixed(1)

function Tape({ derived }: { derived: Derived }) {
  const { budget } = derived
  const stock = Math.max(1, budget.sheetsStock)
  const over = budget.sheetsUsed > budget.sheetsStock
  const fill = Math.min(1, budget.sheetsFraction / stock)
  const timberText = budget.timberNeeded === 0
    ? 'No timber in this design'
    : budget.timberStockKnown
      ? `Timber ${m(budget.timberNeeded)} m of ${m(budget.timberStock)} m in stock`
      : `Timber ${m(budget.timberNeeded)} m, ${budget.timberBars} bars to buy or count`
  return (
    <div className="tape" data-over={over} title="OSB sheets used by the current nesting, against the sheets you have">
      <div className="tape-strip" role="meter" aria-valuemin={0} aria-valuemax={stock} aria-valuenow={budget.sheetsFraction} aria-label="OSB sheets used">
        <div className="tape-fill" style={{ width: `${fill * 100}%` }} />
        {Array.from({ length: stock }, (_, i) => (
          // A tick's number sits just right of its line; draw it light once the fill passes it.
          <div key={i} className={`tape-tick${i / stock < fill ? ' covered' : ''}`} style={{ left: `${(i / stock) * 100}%` }}>
            <span>{i + 1}</span>
          </div>
        ))}
      </div>
      <div className="tape-text">
        <strong>
          {budget.sheetsFraction.toFixed(1)} of {budget.sheetsStock} sheets
        </strong>
        <small>{timberText}</small>
      </div>
    </div>
  )
}

export function Header({ derived }: { derived: Derived }) {
  const tab = usePlan((s) => s.view.tab)
  const setView = usePlan((s) => s.setView)
  const fileRef = useRef<HTMLInputElement>(null)
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null)

  const flash = (text: string, error = false) => {
    setToast({ text, error })
    setTimeout(() => setToast(null), 3500)
  }

  const exportPlan = () => {
    const blob = new Blob([planStore.getState().exportJson()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `cabinet-plan-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    flash('Plan exported')
  }

  const importPlan = async (file: File) => {
    const res = planStore.getState().importJson(await file.text())
    flash(res.ok ? `Imported ${file.name}` : `Import failed: ${res.error}`, !res.ok)
  }

  return (
    <header className="header">
      <div className="brand">Cabinet Planner</div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'layout'} onClick={() => setView({ tab: 'layout' })}>
          Shop layout
        </button>
        <button role="tab" aria-selected={tab === 'cut'} onClick={() => setView({ tab: 'cut' })}>
          Cut plan
        </button>
      </div>
      <Tape derived={derived} />
      <div className="header-actions">
        <button className="btn" onClick={exportPlan}>
          Export
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          Import
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) importPlan(f)
            e.target.value = ''
          }}
        />
        <ConfirmButton label="Reset" confirmLabel="Reset to the starting plan?" onConfirm={() => planStore.getState().reset()} />
      </div>
      {toast && <div className={`toast${toast.error ? ' error' : ''}`}>{toast.text}</div>}
    </header>
  )
}
