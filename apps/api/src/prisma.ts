import { PrismaClient } from '@prisma/client'

let prismaClient: PrismaClient | null = null

export async function getPrisma() {
  prismaClient ??= new PrismaClient()
  return prismaClient
}
