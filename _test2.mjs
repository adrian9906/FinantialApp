import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const { PrismaClient } = require('@prisma/client')
console.log('PrismaClient loaded')

const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3')
console.log('PrismaBetterSqlite3 loaded')

const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' })
console.log('adapter created')

const prisma = new PrismaClient({ adapter })
console.log('prisma created')
console.log('salario model type:', typeof prisma.salario)
console.log('usuario model type:', typeof prisma.usuario)

try {
  const result = await prisma.salario.findMany()
  console.log('findMany succeeded:', result.length)
} catch (e) {
  console.log('findMany error:', e.message, e.stack)
}

await prisma.$disconnect()
