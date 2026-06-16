import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'

import { getPrisma } from './prisma'

const SESSION_COOKIE = 'vault_session'
const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function parseCookies(req: IncomingMessage) {
  const header = req.headers.cookie
  if (!header) return {}

  return header.split(';').reduce<Record<string, string>>((accumulator, pair) => {
    const [rawKey, ...rawValue] = pair.trim().split('=')
    if (!rawKey) return accumulator
    accumulator[rawKey] = decodeURIComponent(rawValue.join('='))
    return accumulator
  }, {})
}

function serializeCookie(name: string, value: string, options?: { maxAge?: number }) {
  const cookie = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ]

  if (options?.maxAge !== undefined) {
    cookie.push(`Max-Age=${options.maxAge}`)
  }

  return cookie.join('; ')
}

function createPasswordHash(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${derived}`
}

export function hashPassword(password: string) {
  return createPasswordHash(password)
}

function verifyHashedPassword(password: string, storedValue: string) {
  const [salt, storedHash] = storedValue.split(':')
  if (!salt || !storedHash) return false

  const derived = scryptSync(password, salt, 64)
  const storedBuffer = Buffer.from(storedHash, 'hex')

  if (derived.length !== storedBuffer.length) return false

  return timingSafeEqual(derived, storedBuffer)
}

export function verifyPassword(password: string, storedValue: string) {
  if (!storedValue.includes(':')) {
    return password === storedValue
  }

  return verifyHashedPassword(password, storedValue)
}

export async function ensureSeedUser() {
  const prisma = await getPrisma()
  const hashedPassword = createPasswordHash('local-dev')

  return prisma.usuario.upsert({
    where: { correo: 'local@vault.app' },
    update: {},
    create: {
      nombre: 'Vault Local',
      correo: 'local@vault.app',
      contrasena: hashedPassword,
    },
  })
}

export async function createSession(res: ServerResponse, userId: string, rememberMe: boolean) {
  const prisma = await getPrisma()
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + (rememberMe ? THIRTY_DAYS_IN_SECONDS : 60 * 60 * 24) * 1000)

  await prisma.sesion.create({
    data: {
      tokenHash: sha256(token),
      rememberMe,
      expiresAt,
      usuarioId: userId,
    },
  })

  res.setHeader('Set-Cookie', serializeCookie(SESSION_COOKIE, token, rememberMe ? { maxAge: THIRTY_DAYS_IN_SECONDS } : undefined))
}

export async function clearSession(req: IncomingMessage, res: ServerResponse) {
  const prisma = await getPrisma()
  const cookies = parseCookies(req)
  const token = cookies[SESSION_COOKIE]

  if (token) {
    await prisma.sesion.deleteMany({
      where: { tokenHash: sha256(token) },
    })
  }

  res.setHeader('Set-Cookie', serializeCookie(SESSION_COOKIE, '', { maxAge: 0 }))
}

export async function getSessionUser(req: IncomingMessage) {
  const prisma = await getPrisma()
  const cookies = parseCookies(req)
  const token = cookies[SESSION_COOKIE]

  if (!token) return null

  const session = await prisma.sesion.findUnique({
    where: { tokenHash: sha256(token) },
    include: { usuario: true },
  })

  if (!session) return null

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.sesion.delete({ where: { id: session.id } })
    return null
  }

  return session.usuario
}
