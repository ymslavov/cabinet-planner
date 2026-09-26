import { useEffect, useState, type ReactNode } from 'react'

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10))

/**
 * Numeric input that commits on blur or Enter and reverts on Escape, so typing "7" on the
 * way to "750" doesn't regenerate every cabinet at 7 mm.
 * With `placeholderValue` + `onClear`, an empty/cleared field means "use the computed value".
 */
export function NumberField(props: {
  label: string
  value: number | undefined
  onChange: (v: number) => void
  unit?: string
  min?: number
  max?: number
  step?: number
  placeholderValue?: number
  onClear?: () => void
  wide?: boolean
  title?: string
}) {
  const { label, value, onChange, unit = 'mm', min, max, placeholderValue, onClear, wide, title } = props
  const [text, setText] = useState(value === undefined ? '' : fmt(value))
  useEffect(() => setText(value === undefined ? '' : fmt(value)), [value])

  const commit = () => {
    const trimmed = text.trim()
    if (trimmed === '' && onClear) {
      onClear()
      return
    }
    const n = Number(trimmed.replace(',', '.'))
    if (!Number.isFinite(n) || (min !== undefined && n < min) || (max !== undefined && n > max)) {
      setText(value === undefined ? '' : fmt(value))
      return
    }
    if (n !== value) onChange(n)
  }

  const overridden = onClear !== undefined && value !== undefined
  return (
    <label className={`field${wide ? ' wide' : ''}`} title={title}>
      <span>{label}</span>
      <div className={`input-wrap${overridden ? ' overridden' : ''}`}>
        <input
          inputMode="decimal"
          value={text}
          placeholder={placeholderValue === undefined ? '' : fmt(placeholderValue)}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') {
              setText(value === undefined ? '' : fmt(value))
              ;(e.target as HTMLInputElement).blur()
            }
          }}
        />
        {overridden ? (
          <button type="button" className="reset" onClick={onClear} title="Go back to the computed value">
            auto
          </button>
        ) : (
          unit && <span className="unit">{unit}</span>
        )}
      </div>
    </label>
  )
}

export function TextField(props: { label: string; value: string; onChange: (v: string) => void; wide?: boolean; multiline?: boolean }) {
  const [text, setText] = useState(props.value)
  useEffect(() => setText(props.value), [props.value])
  const commit = () => text !== props.value && props.onChange(text)
  return (
    <label className={`field${props.wide ? ' wide' : ''}`}>
      <span>{props.label}</span>
      <div className="input-wrap">
        {props.multiline ? (
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} />
        ) : (
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        )}
      </div>
    </label>
  )
}

export function SelectField<T extends string>(props: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  wide?: boolean
}) {
  return (
    <label className={`field${props.wide ? ' wide' : ''}`}>
      <span>{props.label}</span>
      <div className="input-wrap">
        <select value={props.value} onChange={(e) => props.onChange(e.target.value as T)}>
          {props.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </label>
  )
}

export function Check(props: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      {props.label}
    </label>
  )
}

export function Segmented<T extends string>(props: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="group">
      {props.options.map((o) => (
        <button key={o.value} type="button" aria-pressed={props.value === o.value} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** A destructive button that needs a second click within 3 s — the app has no dialogs. */
export function ConfirmButton(props: { label: string; confirmLabel?: string; onConfirm: () => void; small?: boolean; danger?: boolean }) {
  const danger = props.danger ?? true
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button
      type="button"
      className={`btn${danger ? ' danger' : ''}${armed ? ' armed' : ''}${props.small ? ' small' : ''}`}
      onClick={() => (armed ? (setArmed(false), props.onConfirm()) : setArmed(true))}
    >
      {armed ? (props.confirmLabel ?? `Click again to ${props.label.toLowerCase()}`) : props.label}
    </button>
  )
}
