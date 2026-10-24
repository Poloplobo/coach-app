// Lance un fichier de tests pgTAP sur la base de SUPABASE_DB_URL (remplace « supabase test db », qui exige Docker)
import pg from 'pg'
import { readFileSync } from 'node:fs'
// shortcut: certificat de la base non vérifié (Supabase signe avec sa propre autorité) ; ne lancer test:db:prod que sur un réseau de confiance, ou fournir le certificat CA du projet (ssl: { ca })
const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  const res = await client.query(readFileSync(process.argv[2], 'utf8'))
  const lines = [res].flat().flatMap(r => r.rows ?? []).flatMap(Object.values).filter(v => typeof v === 'string')
  lines.forEach(l => console.log(l))
  // finish() écrit « Looks like… » quand le nombre de tests ne correspond pas à plan(N)
  if (lines.some(l => l.startsWith('not ok') || l.includes('Looks like'))) process.exitCode = 1
} catch (e) { console.error('ERREUR SQL:', e.message); process.exitCode = 1 }
await client.end()
