import { useState } from 'react'
import { SpaceTabs } from '../../../components/ui/SpaceTabs'
import { WeeksPanel } from './WeeksPanel'
import { GroupPlanPanel } from './GroupPlanPanel'
import { TargetRpePanel } from './TargetRpePanel'

const VIEWS = [
  { id: 'semaines', label: 'Semaines et duplication' },
  { id: 'planning', label: 'Planning du groupe' },
  { id: 'rpe', label: 'RPE visés et seuils' },
] as const
type ViewId = (typeof VIEWS)[number]['id']

// Programmation : l'app est la seule source. Séances de musculation (création, import d'un cycle) : onglet Musculation
export function ProgrammingView() {
  const [view, setView] = useState<ViewId>('semaines')
  return (
    <>
      <SpaceTabs label="Programmation" value={view} onChange={setView} options={VIEWS} />
      <div role="tabpanel" className="flex flex-col gap-6">
        {view === 'semaines' && <WeeksPanel />}
        {view === 'planning' && <GroupPlanPanel />}
        {view === 'rpe' && <TargetRpePanel />}
      </div>
    </>
  )
}
