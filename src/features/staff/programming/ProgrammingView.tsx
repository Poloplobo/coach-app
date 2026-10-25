import { useState } from 'react'
import { ViewSelect } from '../../../components/ui/ViewSelect'
import { WeeksPanel } from './WeeksPanel'
import { GroupPlanPanel } from './GroupPlanPanel'
import { MuscuEditor } from './MuscuEditor'
import { ImportPanel } from './ImportPanel'

const VIEWS = [
  { id: 'semaines', label: 'Semaines et duplication' },
  { id: 'planning', label: 'Planning du groupe' },
  { id: 'muscu', label: 'Séance de musculation' },
  { id: 'import', label: 'Import d\'un cycle' },
] as const
type ViewId = (typeof VIEWS)[number]['id']

// Programmation : l'app est la seule source ; les fiches musculation d'un nouveau cycle s'importent depuis la vue Import
export function ProgrammingView() {
  const [view, setView] = useState<ViewId>('semaines')
  return (
    <>
      <ViewSelect label="Afficher" value={view} onChange={setView}>
        {VIEWS.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
      </ViewSelect>
      <div className="flex flex-col gap-6">
        {view === 'semaines' && <WeeksPanel />}
        {view === 'planning' && <GroupPlanPanel />}
        {view === 'muscu' && <MuscuEditor />}
        {view === 'import' && <ImportPanel />}
      </div>
    </>
  )
}
