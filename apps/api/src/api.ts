import type { IncomingMessage, ServerResponse } from 'node:http'
import type {
  AppEvent,
  BootstrapPayload,
  Debt,
  MonthlyPlanningHistory,
  MonthlyPlanningItem,
  Projection,
  Reminder,
  Salary,
  SavingsGoal,
  Transaction,
  WishlistItem,
} from '@plata/shared'
import type { Prisma } from '@prisma/client'

import { clearSession, createSession, getSessionUser, hashPassword, verifyPassword } from './auth.js'
import { getPrisma } from './prisma.js'

type JsonRecord = Record<string, unknown>

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function applyCorsHeaders(req: IncomingMessage, res: ServerResponse) {
  const requestOrigin = req.headers.origin
  const configuredOrigin = process.env.APP_URL?.trim()
  const allowOrigin = configuredOrigin || requestOrigin || '*'

  res.setHeader('Access-Control-Allow-Origin', allowOrigin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader('Vary', 'Origin')
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
  aportado: number
  comprado: boolean
  items: Array<{ nombre: string; precio: number; prioridad: string; foto: string | null; tienda: string | null; urlReferencia: string | null; moneda: string | null }>
}): WishlistItem {
  const item = entry.items[0]
  const isPurchased = entry.comprado || entry.cantidad > 0

  return {
    id: entry.id,
    name: item?.nombre ?? 'Deseo',
    price: item?.precio ?? 0,
    priority: normalizePriority(item?.prioridad),
    savedAmount: isPurchased ? entry.cantidad : 0,
    externalContribution: entry.aportado,
    isPurchased,
    image: item?.foto ?? undefined,
    sourceStore: item?.tienda ?? undefined,
    sourceUrl: item?.urlReferencia ?? undefined,
    sourceCurrency: item?.moneda ?? undefined,
  }
}

function serializeDebt(entry: {
  id: string
  cantidad: number
  historial: string
  fechaInicio: Date
  fechaTerminacion: Date
  interes: number | null
  pagos?: Array<{ cantidad: number; fecha: Date }>
}): Debt {
  const paidAmount = entry.pagos?.reduce((sum, payment) => sum + payment.cantidad, 0) ?? 0
  const remainingAmount = Math.max(0, entry.cantidad - paidAmount)
  return {
    id: entry.id,
    amount: entry.cantidad,
    history: entry.historial,
    startDate: toDateString(entry.fechaInicio),
    endDate: toDateString(entry.fechaTerminacion),
    interest: entry.interes ?? undefined,
    paidAmount,
    remainingAmount,
    progress: entry.cantidad > 0 ? Math.min(100, Math.round((paidAmount / entry.cantidad) * 100)) : 100,
    isSettled: remainingAmount === 0,
    payments: entry.pagos?.map((payment) => ({
      amount: payment.cantidad,
      date: toDateString(payment.fecha),
    })) ?? [],
  }
}

function parseMonthlyPlanningItems(value: unknown): MonthlyPlanningItem[] {
  if (!Array.isArray(value)) return []

  return value.map((entry) => {
    const item = entry as Record<string, unknown>

    return {
      amount: Number(item.amount ?? 0),
      itemName: String(item.itemName ?? ''),
      category: String(item.category ?? ''),
      status: item.status === 'pending' ? 'pending' : 'checked',
      date: String(item.date ?? toDateString(new Date())),
    }
  })
}

function serializeMonthlyPlanningHistory(entry: {
  id: string
  mesReferencia: string
  etiqueta: string
  createdAt: Date
  gastos: unknown
  gustos: unknown
}): MonthlyPlanningHistory {
  return {
    id: entry.id,
    month: entry.mesReferencia,
    label: entry.etiqueta,
    createdAt: entry.createdAt.toISOString(),
    expenses: parseMonthlyPlanningItems(entry.gastos),
    wants: parseMonthlyPlanningItems(entry.gustos),
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

function normalizeSavingsGoalCategory(value: unknown): SavingsGoal['category'] {
  if (value === 'emergency' || value === 'travel' || value === 'rent' || value === 'phone' || value === 'custom') {
    return value
  }

  return 'custom'
}

function serializeSavingsGoal(entry: {
  id: string
  nombre: string
  categoria: string
  montoObjetivo: number
  montoActual: number
  aporteMensual: number
}): SavingsGoal {
  return {
    id: entry.id,
    name: entry.nombre,
    category: normalizeSavingsGoalCategory(entry.categoria),
    targetAmount: entry.montoObjetivo,
    currentAmount: entry.montoActual,
    monthlyContribution: entry.aporteMensual,
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

  const [salaries, expenses, wants, savings, debts, wishlist, monthlyPlanningHistory, events, projections, savingsGoals, reminders] = await Promise.all([
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
    prisma.deuda.findMany({
      where: { usuarioId: userId },
      include: { pagos: true },
      orderBy: { fechaTerminacion: 'asc' },
    }),
    prisma.deseo.findMany({
      where: { usuarioId: userId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.historialMensual.findMany({
      where: { usuarioId: userId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.evento.findMany({ where: { usuarioId: userId }, orderBy: { fecha: 'asc' } }),
    prisma.proyeccion.findMany({ where: { usuarioId: userId }, orderBy: { createdAt: 'desc' } }),
    prisma.metaAhorro.findMany({ where: { usuarioId: userId }, orderBy: { createdAt: 'desc' } }),
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
    monthlyPlanningHistory: monthlyPlanningHistory.map(serializeMonthlyPlanningHistory),
    events: events.map(serializeEvent),
    projections: projections.map(serializeProjection),
    savingsGoals: savingsGoals.map(serializeSavingsGoal),
    reminders: reminders.map(serializeReminder),
  }
}

function normalizeSyncPayload(body: JsonRecord): BootstrapPayload {
  return {
    salaries: Array.isArray(body.salaries) ? body.salaries as Salary[] : [],
    transactions: Array.isArray(body.transactions) ? body.transactions as Transaction[] : [],
    debts: Array.isArray(body.debts) ? body.debts as Debt[] : [],
    wishlist: Array.isArray(body.wishlist) ? body.wishlist as WishlistItem[] : [],
    monthlyPlanningHistory: Array.isArray(body.monthlyPlanningHistory) ? body.monthlyPlanningHistory as MonthlyPlanningHistory[] : [],
    events: Array.isArray(body.events) ? body.events as AppEvent[] : [],
    projections: Array.isArray(body.projections) ? body.projections as Projection[] : [],
    savingsGoals: Array.isArray(body.savingsGoals) ? body.savingsGoals as SavingsGoal[] : [],
    reminders: Array.isArray(body.reminders) ? body.reminders as Reminder[] : [],
  }
}

async function syncBootstrap(userId: string, body: JsonRecord) {
  const prisma = await getPrisma()
  const payload = normalizeSyncPayload(body)
  const transactions = payload.transactions
  const expenses = transactions.filter((entry) => entry.type === 'expense')
  const wants = transactions.filter((entry) => entry.type === 'want')
  const savings = transactions.filter((entry) => entry.type === 'saving')

  await prisma.$transaction(async (tx) => {
    await tx.salario.deleteMany({ where: { usuarioId: userId } })
    await tx.ahorro.deleteMany({ where: { usuarioId: userId } })
    await tx.gasto.deleteMany({ where: { usuarioId: userId } })
    await tx.gusto.deleteMany({ where: { usuarioId: userId } })
    await tx.deuda.deleteMany({ where: { usuarioId: userId } })
    await tx.deseo.deleteMany({ where: { usuarioId: userId } })
    await tx.historialMensual.deleteMany({ where: { usuarioId: userId } })
    await tx.evento.deleteMany({ where: { usuarioId: userId } })
    await tx.proyeccion.deleteMany({ where: { usuarioId: userId } })
    await tx.metaAhorro.deleteMany({ where: { usuarioId: userId } })
    await tx.notificacion.deleteMany({ where: { usuarioId: userId } })

    for (const entry of payload.salaries) {
      await tx.salario.create({
        data: {
          id: entry.id,
          salario: Number(entry.amount ?? 0),
          fecha: toMonthDate(String(entry.month ?? toMonthString(new Date()))),
          usuarioId: userId,
        },
      })
    }

    for (const entry of expenses) {
      await tx.gasto.create({
        data: {
          id: entry.id,
          cantidad: Number(entry.amount ?? 0),
          fecha: entry.date ? new Date(entry.date) : new Date(),
          usuarioId: userId,
          items: {
            create: {
              nombre: String(entry.description ?? 'Gasto'),
              precio: Number(entry.amount ?? 0),
              fecha: entry.date ? new Date(entry.date) : new Date(),
              categoria: 'expense',
            },
          },
        },
      })
    }

    for (const entry of wants) {
      await tx.gusto.create({
        data: {
          id: entry.id,
          cantidad: Number(entry.amount ?? 0),
          fecha: entry.date ? new Date(entry.date) : new Date(),
          usuarioId: userId,
          items: {
            create: {
              nombre: String(entry.description ?? 'Gusto'),
              precio: Number(entry.amount ?? 0),
              fecha: entry.date ? new Date(entry.date) : new Date(),
              categoria: 'want',
            },
          },
        },
      })
    }

    for (const entry of savings) {
      await tx.ahorro.create({
        data: {
          id: entry.id,
          cantidad: Number(entry.amount ?? 0),
          fecha: entry.date ? new Date(entry.date) : new Date(),
          usuarioId: userId,
        },
      })
    }

    for (const entry of payload.debts) {
      await tx.deuda.create({
        data: {
          id: entry.id,
          cantidad: Number(entry.amount ?? 0),
          historial: String(entry.history ?? ''),
          fechaInicio: entry.startDate ? new Date(entry.startDate) : new Date(),
          fechaTerminacion: entry.endDate ? new Date(entry.endDate) : new Date(),
          interes: entry.interest === undefined ? null : Number(entry.interest),
          usuarioId: userId,
          pagos: {
            create: (entry.payments ?? []).map((payment) => ({
              cantidad: Number(payment.amount ?? 0),
              fecha: payment.date ? new Date(payment.date) : new Date(),
            })),
          },
        },
      })
    }

    for (const entry of payload.wishlist) {
      await tx.deseo.create({
        data: {
          id: entry.id,
          cantidad: Number(entry.savedAmount ?? 0),
          aportado: Number(entry.externalContribution ?? 0),
          comprado: Boolean(entry.isPurchased),
          usuarioId: userId,
          items: {
            create: {
              nombre: String(entry.name ?? 'Deseo'),
              precio: Number(entry.price ?? 0),
              prioridad: normalizePriority(entry.priority),
              foto: entry.image ?? null,
              tienda: entry.sourceStore ?? null,
              urlReferencia: entry.sourceUrl ?? null,
              moneda: entry.sourceCurrency ?? null,
            },
          },
        },
      })
    }

    for (const entry of payload.monthlyPlanningHistory) {
      await tx.historialMensual.create({
        data: {
          id: entry.id,
          mesReferencia: String(entry.month ?? toMonthString(new Date())),
          etiqueta: String(entry.label ?? entry.month ?? ''),
          gastos: (entry.expenses ?? []) as unknown as Prisma.InputJsonValue,
          gustos: (entry.wants ?? []) as unknown as Prisma.InputJsonValue,
          usuarioId: userId,
        },
      })
    }

    for (const entry of payload.events) {
      await tx.evento.create({
        data: {
          id: entry.id,
          nombre: String(entry.name ?? ''),
          cantidad: Number(entry.amount ?? 0),
          fecha: entry.date ? new Date(entry.date) : new Date(),
          isNotificacion: Boolean(entry.isNotification),
          usuarioId: userId,
        },
      })
    }

    for (const entry of payload.projections) {
      await tx.proyeccion.create({
        data: {
          id: entry.id,
          salarioMeta: Number(entry.targetSalary ?? 0),
          usuarioId: userId,
        },
      })
    }

    for (const entry of payload.savingsGoals) {
      await tx.metaAhorro.create({
        data: {
          id: entry.id,
          nombre: String(entry.name ?? ''),
          categoria: normalizeSavingsGoalCategory(entry.category),
          montoObjetivo: Number(entry.targetAmount ?? 0),
          montoActual: Number(entry.currentAmount ?? 0),
          aporteMensual: Number(entry.monthlyContribution ?? 0),
          usuarioId: userId,
        },
      })
    }

    for (const entry of payload.reminders) {
      await tx.notificacion.create({
        data: {
          id: entry.id,
          titulo: String(entry.title ?? ''),
          descripcion: entry.description ?? null,
          fecha: entry.date ? new Date(entry.date) : new Date(),
          leida: Boolean(entry.completed),
          usuarioId: userId,
        },
      })
    }
  })

  return loadBootstrap(userId)
}

async function createMonthlyReset(
  userId: string,
  body: JsonRecord,
) {
  const prisma = await getPrisma()
  const month = String(body.month ?? toMonthString(new Date()))
  const label = String(body.label ?? month)
  const expenseIds = Array.isArray(body.expenseIds) ? body.expenseIds.map((entry) => String(entry)) : []
  const wantIds = Array.isArray(body.wantIds) ? body.wantIds.map((entry) => String(entry)) : []
  const expenses = parseMonthlyPlanningItems(body.expenses)
  const wants = parseMonthlyPlanningItems(body.wants)

  const created = await prisma.$transaction(async (tx) => {
    const history = await tx.historialMensual.create({
      data: {
        mesReferencia: month,
        etiqueta: label,
        gastos: expenses as unknown as Prisma.InputJsonValue,
        gustos: wants as unknown as Prisma.InputJsonValue,
        usuarioId: userId,
      },
    })

    if (expenseIds.length > 0) {
      await tx.gasto.deleteMany({
        where: {
          usuarioId: userId,
          id: { in: expenseIds },
        },
      })
    }

    if (wantIds.length > 0) {
      await tx.gusto.deleteMany({
        where: {
          usuarioId: userId,
          id: { in: wantIds },
        },
      })
    }

    return history
  })

  return serializeMonthlyPlanningHistory(created)
}

async function restoreMonthlyReset(
  userId: string,
  historyId: string,
  scope: 'expenses' | 'wants' | 'all',
) {
  const prisma = await getPrisma()
  const history = await prisma.historialMensual.findFirst({
    where: {
      id: historyId,
      usuarioId: userId,
    },
  })

  if (!history) {
    throw new Error('Historial mensual no encontrado.')
  }

  const expenses = parseMonthlyPlanningItems(history.gastos)
  const wants = parseMonthlyPlanningItems(history.gustos)
  const today = new Date()
  const createdTransactions: Transaction[] = []

  await prisma.$transaction(async (tx) => {
    if (scope === 'expenses' || scope === 'all') {
      for (const entry of expenses) {
        const created = await tx.gasto.create({
          data: {
            cantidad: entry.amount,
            fecha: today,
            usuarioId: userId,
            items: {
              create: {
                nombre: `${entry.category}::${entry.status}::${entry.itemName}`,
                precio: entry.amount,
                fecha: today,
                categoria: 'expense',
              },
            },
          },
          include: { items: { orderBy: { createdAt: 'asc' } } },
        })

        createdTransactions.push(serializeExpense(created))
      }
    }

    if (scope === 'wants' || scope === 'all') {
      for (const entry of wants) {
        const created = await tx.gusto.create({
          data: {
            cantidad: entry.amount,
            fecha: today,
            usuarioId: userId,
            items: {
              create: {
                nombre: `${entry.category}::${entry.status}::${entry.itemName}`,
                precio: entry.amount,
                fecha: today,
                categoria: 'want',
              },
            },
          },
          include: { items: { orderBy: { createdAt: 'asc' } } },
        })

        createdTransactions.push(serializeWant(created))
      }
    }
  })

  return createdTransactions
}

async function saveDebt(userId: string, body: JsonRecord, id?: string) {
  const prisma = await getPrisma()
  const amount = Number(body.amount ?? 0)
  const history = String(body.history ?? '').trim()
  const startDate = body.startDate ? new Date(String(body.startDate)) : new Date()
  const endDate = body.endDate ? new Date(String(body.endDate)) : new Date()
  const interest = body.interest === undefined || body.interest === null || body.interest === '' ? null : Number(body.interest)
  const initialPayment = Math.max(0, Number(body.initialPayment ?? 0))

  if (!id) {
    if (!history) {
      throw new Error('El historial de la deuda es obligatorio.')
    }

    const paidAmount = Math.min(amount, initialPayment)
    const created = await prisma.deuda.create({
      data: {
        cantidad: amount,
        historial: history,
        fechaInicio: startDate,
        fechaTerminacion: endDate,
        interes: interest,
        usuarioId: userId,
        pagos: paidAmount > 0
          ? {
              create: {
                cantidad: paidAmount,
                fecha: new Date(),
              },
            }
          : undefined,
      },
      include: {
        pagos: true,
      },
    })

    return serializeDebt(created)
  }

  const existing = await prisma.deuda.findUnique({
    where: { id },
    include: {
      pagos: true,
    },
  })

  if (!existing) {
    throw new Error('Deuda no encontrada.')
  }

  const updated = await prisma.deuda.update({
    data: (() => {
      const nextAmount = body.amount === undefined ? existing.cantidad : amount
      const paidAmount = existing.pagos.reduce((sum, payment) => sum + payment.cantidad, 0)
      const nextHistory = body.history === undefined ? existing.historial : history

      if (!nextHistory.trim()) {
        throw new Error('El historial de la deuda es obligatorio.')
      }

      if (nextAmount < paidAmount) {
        throw new Error(`No puedes dejar la deuda en $${nextAmount.toLocaleString()} porque ya tiene $${paidAmount.toLocaleString()} abonados.`)
      }

      return {
        cantidad: nextAmount,
        historial: nextHistory,
        fechaInicio: body.startDate === undefined ? existing.fechaInicio : startDate,
        fechaTerminacion: body.endDate === undefined ? existing.fechaTerminacion : endDate,
        interes: body.interest === undefined ? existing.interes : interest,
      }
    })(),
    where: { id },
    include: {
      pagos: true,
    },
  })

  return serializeDebt(updated)
}

async function payDebt(userId: string, id: string, amount: number) {
  const prisma = await getPrisma()
  const debt = await prisma.deuda.findFirst({
    where: { id, usuarioId: userId },
    include: { pagos: true },
  })

  if (!debt) {
    throw new Error('Deuda no encontrada.')
  }

  const paidAmount = debt.pagos.reduce((sum, payment) => sum + payment.cantidad, 0)
  const remainingAmount = Math.max(0, debt.cantidad - paidAmount)
  const nextAmount = Math.min(Math.max(0, amount), remainingAmount)

  if (nextAmount <= 0) {
    return serializeDebt(debt)
  }

  const updated = await prisma.deuda.update({
    where: { id },
    data: {
      pagos: {
        create: {
          cantidad: nextAmount,
          fecha: new Date(),
        },
      },
    },
    include: {
      pagos: true,
    },
  })

  return serializeDebt(updated)
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
  const rawSavedAmount = Number(body.savedAmount ?? 0)
  const externalContribution = Math.max(0, Number(body.externalContribution ?? 0))
  const priority = normalizePriority(body.priority)
  const image = body.image ? String(body.image) : null
  const sourceStore = body.sourceStore ? String(body.sourceStore).trim() : null
  const sourceUrl = body.sourceUrl ? String(body.sourceUrl).trim() : null
  const sourceCurrency = body.sourceCurrency ? String(body.sourceCurrency).trim() : null
  const inferredPurchased = rawSavedAmount > 0 && rawSavedAmount >= price
  const isPurchased = typeof body.isPurchased === 'boolean' ? body.isPurchased : inferredPurchased
  const savedAmount = isPurchased ? Math.max(0, rawSavedAmount) : 0

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
        aportado: externalContribution,
        comprado: isPurchased,
        items: existing.items[0]
          ? {
              update: {
                where: { id: existing.items[0].id },
                data: {
                  nombre: name,
                  precio: price,
                  prioridad: priority,
                  foto: image,
                  tienda: sourceStore,
                  urlReferencia: sourceUrl,
                  moneda: sourceCurrency,
                },
              },
            }
          : {
              create: {
                nombre: name,
                precio: price,
                prioridad: priority,
                foto: image,
                tienda: sourceStore,
                urlReferencia: sourceUrl,
                moneda: sourceCurrency,
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
      aportado: externalContribution,
      comprado: isPurchased,
      usuarioId: userId,
      items: {
        create: {
          nombre: name,
          precio: price,
          prioridad: priority,
          foto: image,
          tienda: sourceStore,
          urlReferencia: sourceUrl,
          moneda: sourceCurrency,
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

async function saveSavingsGoal(userId: string, body: JsonRecord, id?: string) {
  const prisma = await getPrisma()
  const payload = {
    nombre: String(body.name ?? '').trim(),
    categoria: normalizeSavingsGoalCategory(body.category),
    montoObjetivo: Number(body.targetAmount ?? 0),
    montoActual: Number(body.currentAmount ?? 0),
    aporteMensual: Number(body.monthlyContribution ?? 0),
  }

  if (!payload.nombre) {
    throw new Error('El nombre de la meta es obligatorio.')
  }

  if (payload.montoObjetivo <= 0) {
    throw new Error('El monto objetivo debe ser mayor que cero.')
  }

  const entry = id
    ? await prisma.metaAhorro.update({
        where: { id },
        data: payload,
      })
    : await prisma.metaAhorro.create({
        data: {
          ...payload,
          usuarioId: userId,
        },
      })

  return serializeSavingsGoal(entry)
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

  applyCorsHeaders(req, res)

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

      const sessionToken = await createSession(res, user.id, rememberMe)
      sendJson(res, 200, {
        user: {
          id: user.id,
          name: user.nombre,
          email: user.correo,
        },
        sessionToken,
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

      const sessionToken = await createSession(res, user.id, rememberMe)
      sendJson(res, 201, {
        user: {
          id: user.id,
          name: user.nombre,
          email: user.correo,
        },
        sessionToken,
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

    if (pathname === '/api/bootstrap/sync' && method === 'PUT') {
      sendJson(res, 200, await syncBootstrap(authenticatedUser.id, await readJsonBody(req)))
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

    if (pathname === '/api/monthly-plans/reset' && method === 'POST') {
      sendJson(res, 201, await createMonthlyReset(authenticatedUser.id, await readJsonBody(req)))
      return true
    }

    const monthlyPlanRestoreMatch = pathname.match(/^\/api\/monthly-plans\/([^/]+)\/restore$/)
    if (monthlyPlanRestoreMatch && method === 'POST') {
      const body = await readJsonBody(req)
      const scope = body.scope === 'expenses' || body.scope === 'wants' ? body.scope : 'all'
      sendJson(res, 200, await restoreMonthlyReset(authenticatedUser.id, monthlyPlanRestoreMatch[1], scope))
      return true
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

    const payDebtMatch = pathname.match(/^\/api\/debts\/([^/]+)\/pay$/)
    if (payDebtMatch && method === 'PATCH') {
      const body = await readJsonBody(req)
      sendJson(res, 200, await payDebt(authenticatedUser.id, payDebtMatch[1], Number(body.amount ?? 0)))
      return true
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

    if (pathname === '/api/savings-goals' && method === 'POST') {
      sendJson(res, 201, await saveSavingsGoal(authenticatedUser.id, await readJsonBody(req)))
      return true
    }

    const savingsGoalMatch = pathname.match(/^\/api\/savings-goals\/([^/]+)$/)
    if (savingsGoalMatch) {
      const id = savingsGoalMatch[1]
      const prisma = await getPrisma()
      if (method === 'PUT') {
        sendJson(res, 200, await saveSavingsGoal(authenticatedUser.id, await readJsonBody(req), id))
        return true
      }
      if (method === 'DELETE') {
        await prisma.metaAhorro.delete({ where: { id } })
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
