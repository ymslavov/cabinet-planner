import { lazy, Suspense, useEffect } from 'react'
import { planStore, usePlan } from '../store'
import { useDerived } from '../useDerived'
import { Header } from './Header'
import { Inspector } from './Inspector'
import { Sidebar } from './Sidebar'
import { ViewBoundary, ViewLoading } from './ViewBoundary'

const LayoutView = lazy(() => import('../three/LayoutView'))
const CutPlan = lazy(() => import('../cutplan/CutPlan'))

export function App() {
  const derived = useDerived()
  const tab = usePlan((s) => s.view.tab)

  // R turns the selected cabinet or fixture, Escape clears the selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select')) return
      const { selection, rotate, select } = planStore.getState()
      if ((e.key === 'r' || e.key === 'R') && selection && (selection.kind === 'cabinet' || selection.kind === 'fixture')) {
        rotate(selection.kind, selection.id)
      }
      if (e.key === 'Escape') select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app">
      <Header derived={derived} />
      <Sidebar derived={derived} />
      <main className="main">
        <ViewBoundary resetKey={tab}>
          <Suspense fallback={<ViewLoading what={tab === 'layout' ? '3D shop layout' : 'cut plan'} />}>
            {tab === 'layout' ? <LayoutView derived={derived} /> : <CutPlan derived={derived} />}
          </Suspense>
        </ViewBoundary>
      </main>
      <Inspector derived={derived} />
    </div>
  )
}
