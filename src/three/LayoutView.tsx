import type { Derived } from '../engine/analyze'

export default function LayoutView({ derived }: { derived: Derived }) {
  return <div style={{ padding: 24 }}>3D layout — {Object.keys(derived.parts).length} cabinets</div>
}
