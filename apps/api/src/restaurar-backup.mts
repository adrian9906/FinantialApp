/**
 * Restaura en la base de datos un respaldo exportado desde el navegador con
 * exportar-datos-navegador.js.
 *
 *   cd apps/api
 *   ./node_modules/.bin/tsx src/restaurar-backup.mts <archivo.json> [--correo tu@correo] [--aplicar]
 *
 * Sin --aplicar solo muestra lo que haria. Escribe por el mismo camino que usa
 * la sincronizacion normal (exchangeSync), asi que los datos quedan igual que
 * si se hubieran sincronizado desde la app.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { syncCollections } from '@plata/shared'

const args = process.argv.slice(2)
const file = args.find((arg) => !arg.startsWith('--'))
const apply = args.includes('--aplicar')
const emailIndex = args.indexOf('--correo')
const email = emailIndex >= 0 ? args[emailIndex + 1] : undefined

if (!file) {
  console.error('Falta el archivo. Uso: restaurar-backup.mts <archivo.json> [--correo x] [--aplicar]')
  process.exit(1)
}

// El .env del backend define DATABASE_URL, igual que para la app.
for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/)
  if (match) process.env[match[1]] ??= match[2].replace(/^["']|["']$/g, '')
}

const backup = JSON.parse(readFileSync(file, 'utf8'))
const snapshots = Object.entries(backup?.indexedDb?.['bootstrap-snapshots'] ?? {})
if (snapshots.length === 0) {
  console.error('El respaldo no trae ningun snapshot. Exporta desde la app con la sesion iniciada.')
  process.exit(1)
}

const [snapshotUserId, rawSnapshot] = snapshots[0] as [string, Record<string, unknown>]
const payload = (rawSnapshot?.snapshot ?? rawSnapshot) as Record<string, unknown>

console.log(`Respaldo del ${backup.exportedAt ?? 'fecha desconocida'} (usuario ${snapshotUserId}).`)
let total = 0
for (const collection of syncCollections) {
  const rows = payload[collection]
  if (Array.isArray(rows) && rows.length > 0) {
    console.log(`  ${collection}: ${rows.length}`)
    total += rows.length
  }
}
if (total === 0) {
  console.error('El snapshot esta vacio; no hay nada que restaurar.')
  process.exit(1)
}

const { getPrisma } = await import('./prisma.ts')
const prisma = await getPrisma()

const user = email
  ? await prisma.usuario.findUnique({ where: { correo: email } })
  : await prisma.usuario.findFirst()

if (!user) {
  console.error(email
    ? `No existe ningun usuario con el correo ${email}. Registrate en la app primero.`
    : 'No hay usuarios en la base de datos. Registrate en la app y repite con --correo.')
  process.exit(1)
}
console.log(`Destino: ${user.correo} (${user.id}).`)

if (!apply) {
  console.log(`\nSimulacion: se escribirian ${total} registros. Repite con --aplicar para hacerlo.`)
  process.exit(0)
}

const { exchangeSync } = await import('./api.ts')

let written = 0
let failed = 0
for (const collection of syncCollections) {
  const rows = payload[collection]
  if (!Array.isArray(rows)) continue

  for (const row of rows) {
    const entityId = (row as { id?: string })?.id
    if (!entityId) continue
    try {
      // baseVersion null = la fila aun no existe en el destino, que es el caso
      // al restaurar sobre una base vacia.
      const result = await exchangeSync(user.id, {
        id: randomUUID(),
        collection,
        entityId,
        baseVersion: null,
        value: row as never,
      })
      if (result.conflict) {
        console.warn(`  conflicto en ${collection}/${entityId}: ya existe en el destino, se omite.`)
        failed += 1
      } else {
        written += 1
      }
    } catch (error) {
      failed += 1
      console.warn(`  error en ${collection}/${entityId}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  console.log(`${collection}: listo (${written} escritos hasta ahora).`)
}

console.log(`\nRestauracion terminada: ${written} registros escritos, ${failed} omitidos.`)
