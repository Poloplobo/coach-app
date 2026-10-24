import { useState } from 'react'
import { WeeksPanel } from './WeeksPanel'
import { GroupPlanPanel } from './GroupPlanPanel'
import { MuscuEditor } from './MuscuEditor'

const TABS = [
  { id: 'semaines', label: 'Semaines' },
  { id: 'planning', label: 'Planning du groupe' },
  { id: 'muscu', label: 'Séance de musculation' },
] as const
type TabId = (typeof TABS)[number]['id']

// Programmation : l'app est la seule source (l'import ne touche plus aux semaines, au planning ni aux programmes)
export function ProgrammingView() {
  const [tab, setTab] = useState<TabId>('semaines')
  return (
    <>
      <div role="tablist" aria-label="Programmation" className="flex flex-wrap gap-1 border-b border-line">
        {TABS.map(t => (
          <button key={t.id} id={`prog-tab-${t.id}`} type="button" role="tab" aria-selected={tab === t.id} aria-controls="prog-panel"
            onClick={() => setTab(t.id)}
            className={`-mb-px rounded-t-lg border-b-2 px-3 py-2 text-sm font-semibold ${tab === t.id ? 'border-rnr text-ink' : 'border-transparent text-ink/60'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div id="prog-panel" role="tabpanel" aria-labelledby={`prog-tab-${tab}`} className="flex flex-col gap-4">
        {tab === 'semaines' && <WeeksPanel />}
        {tab === 'planning' && <GroupPlanPanel />}
        {tab === 'muscu' && <MuscuEditor />}
      </div>
    </>
  )
}
