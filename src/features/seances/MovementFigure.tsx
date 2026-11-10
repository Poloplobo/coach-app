import { MOVEMENT_LABEL, movementOf, type Movement } from './movement'

// Petit bonhomme blanc qui mime l'exercice : deux positions par famille de mouvement, en fondu (index.css, .mv-a / .mv-b).
// Profil tourné vers la droite, sol à y = 45. Mouvements réduits demandés : la première position seule.
type P = [number, number]
type Pose = { h: P; s: P; p: P; kl: P; fl: P; kr: P; fr: P; el: P; hl: P; er: P; hr: P; prop?: string[] }
const stand: Pick<Pose, 'h' | 's' | 'p' | 'kl' | 'fl' | 'kr' | 'fr'> = { h: [24, 8], s: [24, 13], p: [24, 27], kl: [23, 36], fl: [23, 45], kr: [25, 36], fr: [25, 45] }

const POSES: Record<Movement, [Pose, Pose]> = {
  squat: [
    { ...stand, el: [19, 16], hl: [21, 13], er: [29, 16], hr: [27, 13], prop: ['16,13 32,13'] },
    { h: [27, 19], s: [25, 23], p: [18, 32], kl: [28, 34], fl: [24, 45], kr: [29, 35], fr: [26, 45], el: [21, 26], hl: [22, 23], er: [30, 26], hr: [28, 23], prop: ['17,23 33,23'] },
  ],
  lunge: [
    { h: [24, 8], s: [24, 13], p: [24, 27], kl: [29, 35], fl: [31, 45], kr: [20, 36], fr: [16, 45], el: [24, 20], hl: [24, 26], er: [25, 20], hr: [25, 26] },
    { h: [24, 15], s: [24, 20], p: [24, 33], kl: [32, 34], fl: [32, 45], kr: [21, 43], fr: [13, 45], el: [24, 27], hl: [24, 32], er: [25, 27], hr: [25, 32] },
  ],
  hinge: [
    { ...stand, el: [25, 20], hl: [25, 27], er: [26, 20], hr: [26, 27], prop: ['17,27 34,27'] },
    { h: [34, 17], s: [30, 19], p: [19, 25], kl: [21, 35], fl: [20, 45], kr: [22, 35], fr: [21, 45], el: [30, 30], hl: [30, 40], er: [31, 30], hr: [31, 40], prop: ['22,40 38,40'] },
  ],
  push_h: [
    { h: [35, 26], s: [31, 28], p: [17, 28], kl: [12, 33], fl: [10, 45], kr: [13, 33], fr: [11, 45], el: [30, 21], hl: [31, 13], er: [32, 21], hr: [32, 13], prop: ['24,13 38,13', '12,31 39,31', '15,31 15,45', '36,31 36,45'] },
    { h: [35, 26], s: [31, 28], p: [17, 28], kl: [12, 33], fl: [10, 45], kr: [13, 33], fr: [11, 45], el: [26, 25], hl: [31, 22], er: [36, 25], hr: [32, 22], prop: ['24,22 38,22', '12,31 39,31', '15,31 15,45', '36,31 36,45'] },
  ],
  push_v: [
    { h: [24, 12], s: [24, 17], p: [24, 30], kl: [23, 38], fl: [23, 45], kr: [25, 38], fr: [25, 45], el: [17, 19], hl: [19, 14], er: [31, 19], hr: [29, 14], prop: ['14,14 34,14'] },
    { h: [24, 12], s: [24, 17], p: [24, 30], kl: [23, 38], fl: [23, 45], kr: [25, 38], fr: [25, 45], el: [19, 9], hl: [20, 3], er: [29, 9], hr: [28, 3], prop: ['14,3 34,3'] },
  ],
  pull_h: [
    { h: [34, 17], s: [30, 19], p: [19, 25], kl: [21, 35], fl: [20, 45], kr: [22, 35], fr: [21, 45], el: [30, 30], hl: [30, 38], er: [31, 30], hr: [31, 38], prop: ['23,38 38,38'] },
    { h: [34, 17], s: [30, 19], p: [19, 25], kl: [21, 35], fl: [20, 45], kr: [22, 35], fr: [21, 45], el: [23, 24], hl: [27, 28], er: [24, 24], hr: [28, 28], prop: ['20,28 35,28'] },
  ],
  pull_v: [
    { h: [24, 12], s: [24, 17], p: [24, 31], kl: [23, 38], fl: [23, 45], kr: [25, 38], fr: [25, 45], el: [19, 10], hl: [18, 4], er: [29, 10], hr: [30, 4], prop: ['10,4 38,4'] },
    { h: [24, 6], s: [24, 11], p: [24, 25], kl: [23, 32], fl: [23, 39], kr: [25, 32], fr: [25, 39], el: [15, 9], hl: [18, 4], er: [33, 9], hr: [30, 4], prop: ['10,4 38,4'] },
  ],
  core: [
    { h: [37, 31], s: [33, 33], p: [20, 35], kl: [14, 36], fl: [8, 38], kr: [14, 36], fr: [8, 38], el: [33, 40], hl: [39, 40], er: [33, 40], hr: [39, 40] },
    { h: [37, 30], s: [33, 32], p: [20, 32], kl: [14, 35], fl: [8, 38], kr: [14, 35], fr: [8, 38], el: [33, 40], hl: [39, 40], er: [33, 40], hr: [39, 40] },
  ],
  jump: [
    { h: [27, 19], s: [25, 23], p: [19, 32], kl: [28, 34], fl: [24, 45], kr: [29, 35], fr: [26, 45], el: [19, 28], hl: [15, 30], er: [20, 28], hr: [16, 31], prop: ['34,36 44,36 44,45 34,45 34,36'] },
    { h: [27, 4], s: [27, 9], p: [27, 22], kl: [30, 28], fl: [28, 34], kr: [31, 29], fr: [29, 35], el: [31, 4], hl: [33, 0], er: [32, 5], hr: [35, 1], prop: ['34,36 44,36 44,45 34,45 34,36'] },
  ],
  rotation: [
    { ...stand, el: [19, 18], hl: [14, 21], er: [20, 19], hr: [14, 22], prop: ['12,21 15,21'] },
    { ...stand, el: [29, 18], hl: [34, 21], er: [28, 19], hr: [34, 22], prop: ['33,21 36,21'] },
  ],
  carry: [
    { h: [24, 8], s: [24, 13], p: [24, 27], kl: [27, 36], fl: [29, 45], kr: [22, 36], fr: [19, 45], el: [22, 20], hl: [22, 27], er: [26, 20], hr: [26, 27], prop: ['20,28 24,28 24,32 20,32 20,28'] },
    { h: [24, 8], s: [24, 13], p: [24, 27], kl: [22, 36], fl: [19, 45], kr: [27, 36], fr: [29, 45], el: [22, 20], hl: [22, 27], er: [26, 20], hr: [26, 27], prop: ['20,28 24,28 24,32 20,32 20,28'] },
  ],
  cardio: [
    { h: [26, 8], s: [25, 13], p: [23, 27], kl: [30, 33], fl: [27, 41], kr: [19, 36], fr: [14, 44], el: [29, 19], hl: [33, 16], er: [20, 19], hr: [18, 24] },
    { h: [26, 8], s: [25, 13], p: [23, 27], kl: [18, 34], fl: [21, 42], kr: [28, 35], fr: [31, 44], el: [20, 19], hl: [17, 16], er: [29, 19], hr: [31, 24] },
  ],
}

const pts = (...p: P[]) => p.map(x => x.join(',')).join(' ')
function Figure({ pose, className }: { pose: Pose; className: string }) {
  return (
    <g className={className}>
      {pose.prop?.map((d, i) => <polyline key={i} points={d} strokeWidth={2} opacity={0.7} />)}
      <circle cx={pose.h[0]} cy={pose.h[1]} r={3.6} fill="currentColor" stroke="none" />
      <polyline points={pts(pose.s, pose.p)} />
      <polyline points={pts(pose.fl, pose.kl, pose.p, pose.kr, pose.fr)} />
      <polyline points={pts(pose.hl, pose.el, pose.s, pose.er, pose.hr)} />
    </g>
  )
}

// Vignette rouge club, bonhomme blanc : lisible en thème sombre comme clair. Exercice non reconnu : rien.
export function MovementFigure({ name }: { name: string }) {
  const m = movementOf(name)
  if (!m) return null
  const [a, b] = POSES[m]
  return (
    <span role="img" aria-label={`Mouvement : ${MOVEMENT_LABEL[m]}`} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rnr text-white">
      <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <Figure pose={a} className="mv-a" />
        <Figure pose={b} className="mv-b" />
      </svg>
    </span>
  )
}
