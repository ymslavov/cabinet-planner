import type { Derived } from '../engine/analyze'

export default function CutPlan({ derived }: { derived: Derived }) {
  return <div style={{ padding: 24 }}>Cut plan — {derived.nest.sheets.length} sheets</div>
}
