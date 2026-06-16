import { createRequire } from 'node:module'

const _metaUrl = import.meta.url
console.error('[prisma] import.meta.url:', _metaUrl)
const require = createRequire(_metaUrl)

let prismaPromise: Promise<any> | null = null

async function createPrismaClient(): Promise<any> {
  const { PrismaClient } = require('@prisma/client') as {
    PrismaClient: new (args?: unknown) => any
  }

  let PrismaBetterSQLite3:
    | (new (args: { url: string }) => unknown)
    | undefined

  try {
    const adapterModule = await import('@prisma/adapter-better-sqlite3')
    PrismaBetterSQLite3 =
      (adapterModule as { PrismaBetterSqlite3?: new (args: { url: string }) => unknown }).PrismaBetterSqlite3
  } catch {
    const fallbackModule = require('@prisma/adapter-better-sqlite3') as {
      PrismaBetterSqlite3?: new (args: { url: string }) => unknown
    }
    PrismaBetterSQLite3 = fallbackModule.PrismaBetterSqlite3
  }

  if (!PrismaBetterSQLite3) {
    throw new Error('No se pudo cargar PrismaBetterSQLite3.')
  }

  const adapter = new PrismaBetterSQLite3({
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
  })

  const client = new PrismaClient({ adapter })
  console.error('[prisma] models:', Object.keys(client).filter(k => !k.startsWith('_')).join(', '))
  return client
}

export async function getPrisma() {
  prismaPromise ??= createPrismaClient()
  return prismaPromise
}
