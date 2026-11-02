import { useState } from 'react'
import { ViewSelect } from '../../components/ui/ViewSelect'
import { GuidelinesPanel } from './GuidelinesPanel'
import { ImportGpsPanel } from './ImportGpsPanel'
import { ImportMaxiPanel } from './ImportMaxiPanel'
import { MatchBoard } from './MatchBoard'
import { MatchNotes } from './MatchNotes'

// Performance (staff) : trois espaces indépendants (décision du 02/11/2026) — GPS, Match (notes), Test (maxi et objectifs)
const SPACES = {
  gps: { label: 'GPS', views: [{ id: 'tableau', label: 'GPS d\'un match et rapports' }, { id: 'import', label: 'Importer les GPS d\'un match' }] },
  match: { label: 'Match', views: [{ id: 'notes', label: 'Matchs et notes' }, { id: 'consignes', label: 'Consignes de notation' }] },
  test: { label: 'Test', views: [{ id: 'maxi', label: 'Importer les maxi et objectifs' }] },
} as const
type Space = keyof typeof SPACES

export function StaffPerformanceView() {
  const [space, setSpace] = useState<Space>('match')
  const [view, setView] = useState<string>(SPACES.match.views[0].id)
  const choose = (s: Space) => { setSpace(s); setView(SPACES[s].views[0].id) }
  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <div role="tablist" aria-label="Performance" className="inline-flex rounded-lg border border-line p-0.5">
          {(Object.keys(SPACES) as Space[]).map(s => (
            <button key={s} type="button" role="tab" aria-selected={space === s} onClick={() => choose(s)}
              className={`rounded-md px-4 py-1.5 font-display text-lg font-semibold ${space === s ? 'bg-rnr text-white' : 'text-ink/70 hover:text-ink'}`}>
              {SPACES[s].label}
            </button>
          ))}
        </div>
        {SPACES[space].views.length > 1 && (
          <ViewSelect label="Afficher" value={view} onChange={setView}>
            {SPACES[space].views.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
          </ViewSelect>
        )}
      </div>
      <div role="tabpanel" className="flex flex-col gap-6">
        {space === 'gps' && view === 'tableau' && <MatchBoard />}
        {space === 'gps' && view === 'import' && <ImportGpsPanel />}
        {space === 'match' && view === 'notes' && <MatchNotes />}
        {space === 'match' && view === 'consignes' && <GuidelinesPanel />}
        {space === 'test' && <ImportMaxiPanel />}
      </div>
    </>
  )
}
