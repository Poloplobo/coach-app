import { Card } from '../../components/ui/Card'
import { seasonOf } from './progress'
import { useSeasonProfile } from './useTests'

// Accueil : son profil de saison (PPID) ; pas encore renseigné par le staff : pas de bloc
export function SeasonProfileCard({ playerId, date }: { playerId: string; date: string }) {
  const profile = useSeasonProfile(playerId, seasonOf(date)).data
  if (!profile || (!profile.profile_type && !profile.main_objective && !profile.power_to_develop)) return null
  return (
    <Card boxed title="Mon profil de saison">
      <dl className="flex flex-col gap-2 text-sm">
        {([['Profil', profile.profile_type], ['Objectif n°1', profile.main_objective], ['Pouvoir à développer', profile.power_to_develop]] as const)
          .filter(([, v]) => v).map(([label, v]) => (
            <div key={label} className="rounded-lg bg-field px-3 py-2">
              <dt className="text-ink/60">{label}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
      </dl>
    </Card>
  )
}
