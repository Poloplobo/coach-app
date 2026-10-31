import { useState } from 'react'
import { ViewSelect } from '../../components/ui/ViewSelect'
import { ImportGpsPanel } from './ImportGpsPanel'
import { ImportMaxiPanel } from './ImportMaxiPanel'

const VIEWS = [
  { id: 'gps', label: 'Import GPS d\'un match' },
  { id: 'maxi', label: 'Import des maxi et objectifs' },
] as const
type ViewId = (typeof VIEWS)[number]['id']

// Performance (staff) : imports ; tableau des matchs et notes à l'étape 11f
export function StaffPerformanceView() {
  const [view, setView] = useState<ViewId>('gps')
  return (
    <>
      <ViewSelect label="Afficher" value={view} onChange={setView}>
        {VIEWS.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
      </ViewSelect>
      <div className="flex flex-col gap-6">
        {view === 'gps' && <ImportGpsPanel />}
        {view === 'maxi' && <ImportMaxiPanel />}
      </div>
    </>
  )
}
