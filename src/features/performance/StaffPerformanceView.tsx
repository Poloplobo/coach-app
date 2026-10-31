import { useState } from 'react'
import { ViewSelect } from '../../components/ui/ViewSelect'
import { GuidelinesPanel } from './GuidelinesPanel'
import { ImportGpsPanel } from './ImportGpsPanel'
import { MatchBoard } from './MatchBoard'
import { ImportMaxiPanel } from './ImportMaxiPanel'

const VIEWS = [
  { id: 'match', label: 'Match : GPS et notes' },
  { id: 'gps', label: 'Import GPS d\'un match' },
  { id: 'maxi', label: 'Import des maxi et objectifs' },
  { id: 'consignes', label: 'Consignes de notation' },
] as const
type ViewId = (typeof VIEWS)[number]['id']

// Performance (staff) : tableau d'un match (GPS, notes joueur et staff), imports GPS et maxi
export function StaffPerformanceView() {
  const [view, setView] = useState<ViewId>('match')
  return (
    <>
      <ViewSelect label="Afficher" value={view} onChange={setView}>
        {VIEWS.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
      </ViewSelect>
      <div className="flex flex-col gap-6">
        {view === 'match' && <MatchBoard />}
        {view === 'gps' && <ImportGpsPanel />}
        {view === 'maxi' && <ImportMaxiPanel />}
        {view === 'consignes' && <GuidelinesPanel />}
      </div>
    </>
  )
}
