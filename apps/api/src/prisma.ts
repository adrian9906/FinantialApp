import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

let prismaClient: PrismaClient | null = null

export async function getPrisma() {
  const connectionString = process.env.DATABASE_URL?.trim()

  if (!connectionString) {
    throw new Error('DATABASE_URL no esta configurada en el entorno del backend.')
  }

  prismaClient ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString }) as any,
  })

  return prismaClient
}
