// Famille de mouvement d'un exercice, d'après son nom (pictogramme animé de la séance). Premier motif trouvé, dans l'ordre :
// les plus spécifiques d'abord (« jump squat » est un saut, « split squat » une fente). Non reconnu : null, pas de pictogramme.
export type Movement = 'squat' | 'lunge' | 'hinge' | 'push_h' | 'push_v' | 'pull_h' | 'pull_v' | 'core' | 'jump' | 'rotation' | 'carry' | 'cardio'

export const MOVEMENT_LABEL: Record<Movement, string> = {
  squat: 'squat', lunge: 'fente', hinge: 'charnière de hanche', push_h: 'poussée horizontale', push_v: 'poussée verticale',
  pull_h: 'tirage horizontal', pull_v: 'tirage vertical', core: 'gainage', jump: 'saut', rotation: 'rotation', carry: 'porté', cardio: 'cardio',
}

const RULES: [RegExp, Movement][] = [
  [/jump|saut|bond|pliom|plyo|\bcmj\b/, 'jump'],
  [/\bvelo\b|bike|\bcourse\b|\brun\b|running|rameur|sprint|elliptique|assault|corde a sauter/, 'cardio'],
  [/farmer|\bporte\b|carry|valise|suitcase|marche/, 'carry'],
  [/rotation|pallof|russian twist|woodchop|bucheron|landmine|lancer/, 'rotation'],
  [/fente|lunge|split squat|bulgare|step[ -]?up/, 'lunge'],
  [/squat|presse a cuisses|leg press|\bchaise\b|wall sit/, 'squat'],
  [/souleve|deadlift|\brdl\b|good morning|hip thrust|pont fessier|glute bridge|swing|ghd|nordic|leg curl|charniere/, 'hinge'],
  [/traction|pull[ -]?up|chin[ -]?up|tirage vertical|lat pull|pulldown|tirage haut/, 'pull_v'],
  [/rowing|\brow\b|tirage horizontal|tirage poitrine|tirage buste/, 'pull_h'],
  [/militaire|overhead|shoulder press|developpe epaule|push press|\bjerk\b|arnold/, 'push_v'],
  [/developpe|bench|pompe|push[ -]?up|\bdips\b|floor press/, 'push_h'],
  [/gainage|planche|plank|psoas|abdo|crunch|hollow|dead bug|bird dog|\bside\b|releve de jambes/, 'core'],
]

export function movementOf(name: string): Movement | null {
  const n = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return RULES.find(([re]) => re.test(n))?.[1] ?? null
}
