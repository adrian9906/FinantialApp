import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)

let prismaClient: PrismaClient | null = null

export async function getPrisma() {
  prismaClient ??= new PrismaClient({ adapter })
  return prismaClient
}
