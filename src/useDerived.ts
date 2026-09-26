import { useMemo } from 'react'
import { analyze, type Derived } from './engine/analyze'
import { usePlan } from './store'

/** The engine's view of the current plan. Recomputes only when the plan itself changes. */
export function useDerived(): Derived {
  const settings = usePlan((s) => s.settings)
  const tools = usePlan((s) => s.tools)
  const cabinets = usePlan((s) => s.cabinets)
  const fixtures = usePlan((s) => s.fixtures)
  return useMemo(() => analyze({ settings, tools, cabinets, fixtures }), [settings, tools, cabinets, fixtures])
}
