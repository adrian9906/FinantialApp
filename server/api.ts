import type { IncomingMessage, ServerResponse } from 'node:http'
import { clearSession, createSession, getSessionUser, hashPassword, verifyPassword } from './auth'
import { getPrisma } from './prisma'

type Salary = {
  id: string
  amount: number
  month: string
}

type Transaction = {
  id: string
  amount: number
  type: 'expense' | 'want' | 'saving'
  description?: string
  date: string
}

type Debt = {
  id: string
  amount: number
  history: string
  startDate: string
  endDate: string
  interest?: number
}

type WishlistItem = {
  id: string
  name: string
  price: number
  priority: 'low' | 'medium' | 'high'
  savedAmount: number
  image?: string
}

type AppEvent = {
  id: string
  name: string
  date: string
  amount: number
  isNotification: boolean
}

type Projection = {
  id: string
  targetSalary: number
}

type Reminder = {
  id: string
  title: string
  description: string
  date: string
  completed: boolean
}

type JsonRecord = Record<string, unknown>

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function sendEmpty(res: ServerResponse, status = 204) {
  res.statusCode = status
  res.end()
}

function sendError(res: ServerResponse, error: unknown) {
  const message = error instanceof Error ? error.message : 'Unexpected server error'
  sendJson(res, 500, { error: message })
}

async function readJsonBody(req: IncomingMessage) {
  const chunks: Uint8Array[] = []

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }

  if (chunks.length === 0) return {}

  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as JsonRecord
}

function toDateString(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10)
}

function toMonthString(value: Date | string) {
  return new Date(value).toISOString().slice(0, 7)
}

function toMonthDate(value: string) {
  return new Date(`${value}-01T00:00:00.000Z`)
}

function sortByDateDesc<T>(items: T[], selector: (item: T) => string) {
  return items.sort((a, b) => new Date(selector(b)).getTime() - new Date(selector(a)).getTime())
}

function normalizePriority(value: unknown): 'low' | 'medium' | 'high' {
  if (value === 'low' || value === 'medium' || value === 'high') return value
  if (value === 'alta') return 'high'
  if (value === 'baja') return 'low'
  return 'medium'
}

function serializeSalary(entry: { id: string; salario: number; fecha: Date }): Salary {
  return {
    id: entry.id,
    amount: entry.salario,
    month: toMonthString(entry.fecha),
  }
}

function serializeExpense(entry: {
  id: string
  cantidad: number
  fecha: Date
  items: Array<{ nombre: string }>
}): Transaction {
  return {
    id: entry.id,
    amount: entry.cantidad,
    type: 'expense',
    description: entry.items[0]?.nombre ?? 'Gasto',
    date: toDateString(entry.fecha),
  }
}

function serializeWant(entry: {
  id: string
  cantidad: number
  fecha: Date
  items: Array<{ nombre: string }>
}): Transaction {
  return {
    id: entry.id,
    amount: entry.cantidad,
    type: 'want',
    description: entry.items[0]?.nombre ?? 'Gusto',
    date: toDateString(entry.fecha),
  }
}

function serializeSaving(entry: { id: string; cantidad: number; fecha: Date }): Transaction {
  return {
    id: entry.id,
    amount: entry.cantidad,
    type: 'saving',
    description: '',
    date: toDateString(entry.fecha),
  }
}

function serializeWishlist(entry: {
  id: string
  cantidad: number
  items: Array<{ nombre: string; precio: number; prioridad: string; foto: string | null }>
}): WishlistItem {
  const item = entry.items[0]

  return {
    id: entry.id,
    name: item?.nombre ?? 'Deseo',
    price: item?.precio ?? 0,
    priority: normalizePriority(item?.prioridad),
    savedAmount: entry.cantidad,
    image: item?.foto ?? undefined,
  }
}

function serializeDebt(entry: {
  id: string
  cantidad: number
  historial: string
  fechaInicio: Date
  fechaTerminacion: Date
  interes: number | null
}): Debt {
  return {
    id: entry.id,
    amount: entry.cantidad,
    history: entry.historial,
    startDate: toDateString(entry.fechaInicio),
    endDate: toDateString(entry.fechaTerminacion),
    interest: entry.interes ?? undefined,
  }
}

function serializeEvent(entry: {
  id: string
  nombre: string
  fecha: Date
  cantidad: number
  isNotificacion: boolean
}): AppEvent {
  return {
    id: entry.id,
    name: entry.nombre,
    date: toDateString(entry.fecha),
    amount: entry.cantidad,
    isNotification: entry.isNotificacion,
  }
}

function serializeProjection(entry: { id: string; salarioMeta: number }): Projection {
  return {
    id: entry.id,
    targetSalary: entry.salarioMeta,
  }
}

function serializeReminder(entry: {
  id: string
  titulo: string
  descripcion: string | null
  fecha: Date
  leida: boolean
}): Reminder {
  return {
    id: entry.id,
    title: entry.titulo,
    description: entry.descripcion ?? '',
    date: toDateString(entry.fecha),
    completed: entry.leida,
  }
}

function sendUnauthorized(res: ServerResponse) {
  sendJson(res, 401, { error: 'No autorizado.' })
}

type AuthenticatedUser = {
  id: string
  nombre: string
  correo: string
}

async function requireUser(req: IncomingMessage, res: ServerResponse): Promise<AuthenticatedUser | null> {
  const user = await getSessionUser(req)

  if (!user) {
    sendUnauthorized(res)
    return null
  }

  return user
}

async function loadBootstrap(userId: string) {
  const prisma = await getPrisma()

  const [salaries, expenses, wants, savings, debts, wishlist, events, projections, reminders] = await Promise.all([
    prisma.salario.findMany({ where: { usuarioId: userId }, orderBy: { fecha: 'desc' } }),
    prisma.gasto.findMany({
      where: { usuarioId: userId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
      orderBy: { fecha: 'desc' },
    }),
    prisma.gusto.findMany({
      where: { usuarioId: userId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
      orderBy: { fecha: 'desc' },
    }),
    prisma.ahorro.findMany({ where: { usuarioId: userId }, orderBy: { fecha: 'desc' } }),
    prisma.deuda.findMany({ where: { usuarioId: userId }, orderBy: { fechaTerminacion: 'asc' } }),
    prisma.deseo.findMany({
      where: { usuarioId: userId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.evento.findMany({ where: { usuarioId: userId }, orderBy: { fecha: 'asc' } }),
    prisma.proyeccion.findMany({ where: { usuarioId: userId }, orderBy: { createdAt: 'desc' } }),
    prisma.notificacion.findMany({ where: { usuarioId: userId }, orderBy: { fecha: 'asc' } }),
  ])

  const transactions = sortByDateDesc(
    [
      ...expenses.map(serializeExpense),
      ...wants.map(serializeWant),
      ...savings.map(serializeSaving),
    ],
    (item) => item.date,
  )

  return {
    salaries: salaries.map(serializeSalary),
    transactions,
    debts: debts.map(serializeDebt),
    wishlist: wishlist.map(serializeWishlist),
    events: events.map(serializeEvent),
    projections: projections.map(serializeProjection),
    reminders: reminders.map(serializeReminder),
  }
}

async function saveDebt(userId: string, body: JsonRecord, id?: string) {
  const prisma = await getPrisma()
  const payload = {
    cantidad: Number(body.amount ?? 0),
    historial: String(body.history ?? '').trim(),
    fechaInicio: body.startDate ? new Date(String(body.startDate)) : new Date(),
    fechaTerminacion: body.endDate ? new Date(String(body.endDate)) : new Date(),
    interes: body.interest === undefined || body.interest === null || body.interest === '' ? null : Number(body.interest),
  }

  if (!payload.historial) {
    throw new Error('El historial de la deuda es obligatorio.')
  }

  const entry = id
    ? await prisma.deuda.update({
        where: { id },
        data: payload,
      })
    : await prisma.deuda.create({
        data: {
          ...payload,
          usuarioId: userId,
        },
      })

  return serializeDebt(entry)
}

async function saveTransaction(
  userId: string,
  kind: 'expense' | 'want',
  body: JsonRecord,
  id?: string,
) {
  const prisma = await getPrisma()
  const amount = Number(body.amount ?? 0)
  const description = String(body.description ?? '').trim()
  const date = body.date ? new Date(String(body.date)) : new Date()

  if (!description) {
    throw new Error('La descripcion es obligatoria.')
  }

  if (kind === 'expense') {
    if (id) {
      const existing = await prisma.gasto.findUnique({
        where: { id },
        include: { items: { orderBy: { createdAt: 'asc' } } },
      })

      if (!existing) {
        throw new Error('Gasto no encontrado.')
      }

      const updated = await prisma.gasto.update({
        where: { id },
        data: {
          cantidad: amount,
          fecha: date,
          items: existing.items[0]
            ? {
                update: {
                  where: { id: existing.items[0].id },
                  data: {
                    nombre: description,
                    precio: amount,
                    fecha: date,
                    categoria: 'expense',
                  },
                },
              }
            : {
                create: {
                  nombre: description,
                  precio: amount,
                  fecha: date,
                  categoria: 'expense',
                },
              },
        },
        include: { items: { orderBy: { createdAt: 'asc' } } },
      })

      return serializeExpense(updated)
    }

    const created = await prisma.gasto.create({
      data: {
        cantidad: amount,
        fecha: date,
        usuarioId: userId,
        items: {
          create: {
            nombre: description,
            precio: amount,
            fecha: date,
            categoria: 'expense',
          },
        },
      },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    })

    return serializeExpense(created)
  }

  if (id) {
    const existing = await prisma.gusto.findUnique({
      where: { id },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    })

    if (!existing) {
      throw new Error('Gusto no encontrado.')
    }

    const updated = await prisma.gusto.update({
      where: { id },
      data: {
        cantidad: amount,
        fecha: date,
        items: existing.items[0]
          ? {
              update: {
                where: { id: existing.items[0].id },
                data: {
                  nombre: description,
                  precio: amount,
                  fecha: date,
                  categoria: 'want',
                },
              },
            }
          : {
              create: {
                nombre: description,
                precio: amount,
                fecha: date,
                categoria: 'want',
              },
            },
      },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    })

    return serializeWant(updated)
  }

  const created = await prisma.gusto.create({
    data: {
      cantidad: amount,
      fecha: date,
      usuarioId: userId,
      items: {
        create: {
          nombre: description,
          precio: amount,
          fecha: date,
          categoria: 'want',
        },
      },
    },
    include: { items: { orderBy: { createdAt: 'asc' } } },
  })

  return serializeWant(created)
}

async function deleteTransaction(kind: 'expense' | 'want' | 'saving', id: string) {
  const prisma = await getPrisma()

  if (kind === 'expense') {
    await prisma.gasto.delete({ where: { id } })
    return
  }

  if (kind === 'want') {
    await prisma.gusto.delete({ where: { id } })
    return
  }

  await prisma.ahorro.delete({ where: { id } })
}

async function saveSaving(userId: string, body: JsonRecord, id?: string) {
  const prisma = await getPrisma()
  const amount = Number(body.amount ?? 0)
  const date = body.date ? new Date(String(body.date)) : new Date()

  const payload = {
    cantidad: amount,
    fecha: date,
  }

  const entry = id
    ? await prisma.ahorro.update({
        where: { id },
        data: payload,
      })
    : await prisma.ahorro.create({
        data: {
          ...payload,
          usuarioId: userId,
        },
      })

  return serializeSaving(entry)
}

async function saveWishlist(userId: string, body: JsonRecord, id?: string) {
  const prisma = await getPrisma()
  const name = String(body.name ?? '').trim()
  const price = Number(body.price ?? 0)
  const savedAmount = Number(body.savedAmount ?? 0)
  const priority = normalizePriority(body.priority)
  const image = body.image ? String(body.image) : body.url ? String(body.url) : null

  if (!name) {
    throw new Error('El nombre del deseo es obligatorio.')
  }

  if (id) {
    const existing = await prisma.deseo.findUnique({
      where: { id },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    })

    if (!existing) {
      throw new Error('Deseo no encontrado.')
    }

    const updated = await prisma.deseo.update({
      where: { id },
      data: {
        cantidad: savedAmount,
        items: existing.items[0]
          ? {
              update: {
                where: { id: existing.items[0].id },
                data: {
                  nombre: name,
                  precio: price,
                  prioridad: priority,
                  foto: image,
                },
              },
            }
          : {
              create: {
                nombre: name,
                precio: price,
                prioridad: priority,
                foto: image,
              },
            },
      },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    })

    return serializeWishlist(updated)
  }

  const created = await prisma.deseo.create({
    data: {
      cantidad: savedAmount,
      usuarioId: userId,
      items: {
        create: {
          nombre: name,
          precio: price,
          prioridad: priority,
          foto: image,
        },
      },
    },
    include: { items: { orderBy: { createdAt: 'asc' } } },
  })

  return serializeWishlist(created)
}

async function saveEvent(userId: string, body: JsonRecord, id?: string) {
  const prisma = await getPrisma()

  const payload = {
    nombre: String(body.name ?? '').trim(),
    cantidad: Number(body.amount ?? 0),
    fecha: body.date ? new Date(String(body.date)) : new Date(),
    isNotificacion: Boolean(body.isNotification),
  }

  if (!payload.nombre) {
    throw new Error('El nombre del evento es obligatorio.')
  }

  const entry = id
    ? await prisma.evento.update({
        where: { id },
        data: payload,
      })
    : await prisma.evento.create({
        data: {
          ...payload,
          usuarioId: userId,
        },
      })

  return serializeEvent(entry)
}

async function saveProjection(userId: string, body: JsonRecord, id?: string) {
  const prisma = await getPrisma()
  const payload = {
    salarioMeta: Number(body.targetSalary ?? 0),
  }

  const entry = id
    ? await prisma.proyeccion.update({
        where: { id },
        data: payload,
      })
    : await prisma.proyeccion.create({
        data: {
          ...payload,
          usuarioId: userId,
        },
      })

  return serializeProjection(entry)
}

async function saveReminder(userId: string, body: JsonRecord, id?: string) {
  const prisma = await getPrisma()
  const payload = {
    titulo: String(body.title ?? '').trim(),
    descripcion: body.description ? String(body.description) : null,
    fecha: body.date ? new Date(String(body.date)) : new Date(),
    leida: Boolean(body.completed),
  }

  if (!payload.titulo) {
    throw new Error('El titulo es obligatorio.')
  }

  const entry = id
    ? await prisma.notificacion.update({
        where: { id },
        data: payload,
      })
    : await prisma.notificacion.create({
        data: {
          ...payload,
          usuarioId: userId,
        },
      })

  return serializeReminder(entry)
}

export async function handleApiRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const { pathname } = url
  const method = req.method ?? 'GET'

  if (method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return true
  }

  if (!pathname.startsWith('/api/')) {
    return false
  }

  try {
    if (pathname === '/api/auth/me' && method === 'GET') {
      const user = await getSessionUser(req)

      if (!user) {
        sendUnauthorized(res)
        return true
      }

      sendJson(res, 200, {
        user: {
          id: user.id,
          name: user.nombre,
          email: user.correo,
        },
      })
      return true
    }

    if (pathname === '/api/auth/login' && method === 'POST') {
      const prisma = await getPrisma()
      const body = await readJsonBody(req)
      const email = String(body.email ?? '').trim().toLowerCase()
      const password = String(body.password ?? '')
      const rememberMe = Boolean(body.rememberMe)

      const user = await prisma.usuario.findUnique({
        where: { correo: email },
      })

      if (!user || !verifyPassword(password, user.contrasena)) {
        sendJson(res, 401, { error: 'Correo o contraseña incorrectos.' })
        return true
      }

      await createSession(res, user.id, rememberMe)
      sendJson(res, 200, {
        user: {
          id: user.id,
          name: user.nombre,
          email: user.correo,
        },
      })
      return true
    }

    if (pathname === '/api/auth/register' && method === 'POST') {
      const prisma = await getPrisma()
      const body = await readJsonBody(req)
      const name = String(body.name ?? '').trim()
      const email = String(body.email ?? '').trim().toLowerCase()
      const password = String(body.password ?? '')
      const rememberMe = Boolean(body.rememberMe)

      if (!name) {
        sendJson(res, 400, { error: 'El nombre es obligatorio.' })
        return true
      }

      if (!email) {
        sendJson(res, 400, { error: 'El correo es obligatorio.' })
        return true
      }

      if (password.length < 6) {
        sendJson(res, 400, { error: 'La contrasena debe tener al menos 6 caracteres.' })
        return true
      }

      const existingUser = await prisma.usuario.findUnique({
        where: { correo: email },
      })

      if (existingUser) {
        sendJson(res, 409, { error: 'Ya existe una cuenta con ese correo.' })
        return true
      }

      const user = await prisma.usuario.create({
        data: {
          nombre: name,
          correo: email,
          contrasena: hashPassword(password),
        },
      })

      await createSession(res, user.id, rememberMe)
      sendJson(res, 201, {
        user: {
          id: user.id,
          name: user.nombre,
          email: user.correo,
        },
      })
      return true
    }

    if (pathname === '/api/auth/logout' && method === 'POST') {
      await clearSession(req, res)
      sendJson(res, 200, { ok: true })
      return true
    }

    const authenticatedUser = await requireUser(req, res)
    if (!authenticatedUser) {
      return true
    }

    if (pathname === '/api/bootstrap' && method === 'GET') {
      sendJson(res, 200, await loadBootstrap(authenticatedUser.id))
      return true
    }

    if (pathname === '/api/salaries' && method === 'POST') {
      const prisma = await getPrisma()
      const body = await readJsonBody(req)
      const created = await prisma.salario.create({
        data: {
          salario: Number(body.amount ?? 0),
          fecha: toMonthDate(String(body.month ?? toMonthString(new Date()))),
          usuarioId: authenticatedUser.id,
        },
      })
      sendJson(res, 201, serializeSalary(created))
      return true
    }

    const salaryMatch = pathname.match(/^\/api\/salaries\/([^/]+)$/)
    if (salaryMatch) {
      const prisma = await getPrisma()
      const body = method === 'PUT' ? await readJsonBody(req) : {}
      const id = salaryMatch[1]

      if (method === 'PUT') {
        const updated = await prisma.salario.update({
          where: { id },
          data: {
            salario: Number(body.amount ?? 0),
            fecha: body.month ? toMonthDate(String(body.month)) : undefined,
          },
        })
        sendJson(res, 200, serializeSalary(updated))
        return true
      }

      if (method === 'DELETE') {
        await prisma.salario.delete({ where: { id } })
        sendEmpty(res)
        return true
      }
    }

    if (pathname === '/api/expenses' && method === 'POST') {
      sendJson(res, 201, await saveTransaction(authenticatedUser.id, 'expense', await readJsonBody(req)))
      return true
    }

    const expenseMatch = pathname.match(/^\/api\/expenses\/([^/]+)$/)
    if (expenseMatch) {
      const id = expenseMatch[1]
      if (method === 'PUT') {
        sendJson(res, 200, await saveTransaction(authenticatedUser.id, 'expense', await readJsonBody(req), id))
        return true
      }
      if (method === 'DELETE') {
        await deleteTransaction('expense', id)
        sendEmpty(res)
        return true
      }
    }

    if (pathname === '/api/wants' && method === 'POST') {
      sendJson(res, 201, await saveTransaction(authenticatedUser.id, 'want', await readJsonBody(req)))
      return true
    }

    const wantMatch = pathname.match(/^\/api\/wants\/([^/]+)$/)
    if (wantMatch) {
      const id = wantMatch[1]
      if (method === 'PUT') {
        sendJson(res, 200, await saveTransaction(authenticatedUser.id, 'want', await readJsonBody(req), id))
        return true
      }
      if (method === 'DELETE') {
        await deleteTransaction('want', id)
        sendEmpty(res)
        return true
      }
    }

    if (pathname === '/api/savings' && method === 'POST') {
      sendJson(res, 201, await saveSaving(authenticatedUser.id, await readJsonBody(req)))
      return true
    }

    const savingMatch = pathname.match(/^\/api\/savings\/([^/]+)$/)
    if (savingMatch) {
      const id = savingMatch[1]
      if (method === 'PUT') {
        sendJson(res, 200, await saveSaving(authenticatedUser.id, await readJsonBody(req), id))
        return true
      }
      if (method === 'DELETE') {
        await deleteTransaction('saving', id)
        sendEmpty(res)
        return true
      }
    }

    if (pathname === '/api/wishlist' && method === 'POST') {
      sendJson(res, 201, await saveWishlist(authenticatedUser.id, await readJsonBody(req)))
      return true
    }

    const wishlistMatch = pathname.match(/^\/api\/wishlist\/([^/]+)$/)
    if (wishlistMatch) {
      const id = wishlistMatch[1]
      const prisma = await getPrisma()
      if (method === 'PUT') {
        sendJson(res, 200, await saveWishlist(authenticatedUser.id, await readJsonBody(req), id))
        return true
      }
      if (method === 'DELETE') {
        await prisma.deseo.delete({ where: { id } })
        sendEmpty(res)
        return true
      }
    }

    if (pathname === '/api/debts' && method === 'POST') {
      sendJson(res, 201, await saveDebt(authenticatedUser.id, await readJsonBody(req)))
      return true
    }

    const debtMatch = pathname.match(/^\/api\/debts\/([^/]+)$/)
    if (debtMatch) {
      const id = debtMatch[1]
      const prisma = await getPrisma()
      if (method === 'PUT') {
        sendJson(res, 200, await saveDebt(authenticatedUser.id, await readJsonBody(req), id))
        return true
      }
      if (method === 'DELETE') {
        await prisma.deuda.delete({ where: { id } })
        sendEmpty(res)
        return true
      }
    }

    if (pathname === '/api/events' && method === 'POST') {
      sendJson(res, 201, await saveEvent(authenticatedUser.id, await readJsonBody(req)))
      return true
    }

    const eventMatch = pathname.match(/^\/api\/events\/([^/]+)$/)
    if (eventMatch) {
      const id = eventMatch[1]
      const prisma = await getPrisma()
      if (method === 'PUT') {
        sendJson(res, 200, await saveEvent(authenticatedUser.id, await readJsonBody(req), id))
        return true
      }
      if (method === 'DELETE') {
        await prisma.evento.delete({ where: { id } })
        sendEmpty(res)
        return true
      }
    }

    if (pathname === '/api/projections' && method === 'POST') {
      sendJson(res, 201, await saveProjection(authenticatedUser.id, await readJsonBody(req)))
      return true
    }

    const projectionMatch = pathname.match(/^\/api\/projections\/([^/]+)$/)
    if (projectionMatch) {
      const id = projectionMatch[1]
      const prisma = await getPrisma()
      if (method === 'PUT') {
        sendJson(res, 200, await saveProjection(authenticatedUser.id, await readJsonBody(req), id))
        return true
      }
      if (method === 'DELETE') {
        await prisma.proyeccion.delete({ where: { id } })
        sendEmpty(res)
        return true
      }
    }

    if (pathname === '/api/reminders' && method === 'POST') {
      sendJson(res, 201, await saveReminder(authenticatedUser.id, await readJsonBody(req)))
      return true
    }

    const toggleMatch = pathname.match(/^\/api\/reminders\/([^/]+)\/toggle$/)
    if (toggleMatch && method === 'PATCH') {
      const prisma = await getPrisma()
      const current = await prisma.notificacion.findUnique({ where: { id: toggleMatch[1] } })
      if (!current) {
        throw new Error('Recordatorio no encontrado.')
      }
      const updated = await prisma.notificacion.update({
        where: { id: toggleMatch[1] },
        data: { leida: !current.leida },
      })
      sendJson(res, 200, serializeReminder(updated))
      return true
    }

    const reminderMatch = pathname.match(/^\/api\/reminders\/([^/]+)$/)
    if (reminderMatch) {
      const id = reminderMatch[1]
      const prisma = await getPrisma()
      if (method === 'PUT') {
        sendJson(res, 200, await saveReminder(authenticatedUser.id, await readJsonBody(req), id))
        return true
      }
      if (method === 'DELETE') {
        await prisma.notificacion.delete({ where: { id } })
        sendEmpty(res)
        return true
      }
    }

    sendJson(res, 404, { error: 'Ruta no encontrada.' })
    return true
  } catch (error) {
    sendError(res, error)
    return true
  }
}
