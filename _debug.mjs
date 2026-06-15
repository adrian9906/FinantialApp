import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const clientPath = require.resolve('@prisma/client')
console.log('resolved client:', clientPath)

const { PrismaClient } = require('@prisma/client')
console.log('PrismaClient:', typeof PrismaClient)

const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3')
const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' })
const prisma = new PrismaClient({ adapter })

console.log('has salario in prisma:', 'salario' in prisma)

// Try accessing from constructor
const keys = Object.keys(prisma)
console.log('keys count:', keys.length, 'sample:', keys.slice(0, 10))

const protoKeys = Object.getOwnPropertyNames(Object.getPrototypeOf(prisma))
console.log('proto keys count:', protoKeys.length, 'sample:', protoKeys.slice(0, 15))

// Check _dmmf
console.log('_dmmf:', !!prisma._dmmf)

// Try to call findMany through a different approach
const prisma2 = new PrismaClient({ adapter })
try {
  const result = await prisma2.usuario.findMany()
  console.log('usuario works:', result.length)
} catch (e) {
  console.log('usuario error:', e.message)
}

await prisma.$disconnect()
await prisma2.$disconnect()
