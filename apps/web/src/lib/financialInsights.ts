import type { Debt, Reminder, WishlistItem } from '@plata/shared'

type OverviewLike = {
  totalSalary: number
  totalExpenses: number
  totalWants: number
  totalSavings: number
  freeSavings: number
  budgetExpenses: number
  budgetWants: number
  budgetSavings: number
}

export type FinancialScoreFactor = {
  key: 'savings' | 'budget' | 'debt' | 'reminders'
  label: string
  current: number
  max: number
  summary: string
  tone: 'good' | 'warn' | 'danger' | 'neutral'
}

export type FinancialScoreSummary = {
  score: number
  status: 'fuerte' | 'estable' | 'atencion' | 'critico'
  headline: string
  factors: FinancialScoreFactor[]
  changes: Array<{
    label: string
    detail: string
    direction: 'up' | 'down'
  }>
}

export type SmartAlert = {
  id: string
  level: 'critical' | 'warning' | 'info' | 'success'
  title: string
  description: string
  actionLabel: string
  href: string
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function ratioToPoints(current: number, target: number, max: number) {
  if (target <= 0) return max
  return Math.round(clamp(current / target, 0, 1) * max)
}

function formatCurrency(value: number) {
  return `$${Math.round(value).toLocaleString()}`
}

function getDateDiffInDays(value: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(value)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function buildFinancialScore({
  overview,
  debts,
  reminders,
}: {
  overview: OverviewLike
  debts: Debt[]
  reminders: Reminder[]
}): FinancialScoreSummary {
  const activeDebts = debts.filter((item) => !item.isSettled)
  const pendingReminders = reminders.filter((item) => !item.completed)
  const overdueReminders = pendingReminders.filter((item) => getDateDiffInDays(item.date) < 0)
  const dueSoonReminders = pendingReminders.filter((item) => {
    const diff = getDateDiffInDays(item.date)
    return diff >= 0 && diff <= 3
  })

  const savingsPoints = ratioToPoints(overview.totalSavings, overview.budgetSavings, 30)
  const expenseCompliance = overview.budgetExpenses > 0
    ? clamp(1 - Math.max(0, overview.totalExpenses - overview.budgetExpenses) / overview.budgetExpenses, 0, 1)
    : 1
  const wantsCompliance = overview.budgetWants > 0
    ? clamp(1 - Math.max(0, overview.totalWants - overview.budgetWants) / overview.budgetWants, 0, 1)
    : 1
  const budgetPoints = Math.round(((expenseCompliance + wantsCompliance) / 2) * 30)

  const totalDebtRemaining = activeDebts.reduce((sum, item) => sum + item.remainingAmount, 0)
  const debtRatio = overview.totalSalary > 0 ? totalDebtRemaining / overview.totalSalary : totalDebtRemaining > 0 ? 1 : 0
  const debtPoints = Math.round(clamp(1 - debtRatio, 0, 1) * 25)

  const reminderHealth = pendingReminders.length === 0
    ? 1
    : clamp(
      1 - ((overdueReminders.length * 1.2) + (dueSoonReminders.length * 0.45)) / Math.max(1, pendingReminders.length),
      0,
      1,
    )
  const reminderPoints = Math.round(reminderHealth * 15)

  const factors: FinancialScoreFactor[] = [
    {
      key: 'savings',
      label: 'Ahorro',
      current: savingsPoints,
      max: 30,
      summary: overview.budgetSavings > 0
        ? `${formatCurrency(overview.totalSavings)} de ${formatCurrency(overview.budgetSavings)} de meta.`
        : 'Todavia no tienes una meta de ahorro definida.',
      tone: savingsPoints >= 22 ? 'good' : savingsPoints >= 12 ? 'warn' : 'danger',
    },
    {
      key: 'budget',
      label: 'Presupuesto',
      current: budgetPoints,
      max: 30,
      summary: `Gastos en ${formatCurrency(overview.totalExpenses)} y gustos en ${formatCurrency(overview.totalWants)} frente a sus techos actuales.`,
      tone: budgetPoints >= 22 ? 'good' : budgetPoints >= 12 ? 'warn' : 'danger',
    },
    {
      key: 'debt',
      label: 'Deuda',
      current: debtPoints,
      max: 25,
      summary: activeDebts.length > 0
        ? `${activeDebts.length} deuda(s) activas con ${formatCurrency(totalDebtRemaining)} pendientes.`
        : 'No tienes deudas activas en este momento.',
      tone: debtPoints >= 18 ? 'good' : debtPoints >= 10 ? 'warn' : 'danger',
    },
    {
      key: 'reminders',
      label: 'Recordatorios',
      current: reminderPoints,
      max: 15,
      summary: pendingReminders.length > 0
        ? `${overdueReminders.length} vencidos y ${dueSoonReminders.length} por vencer pronto.`
        : 'No hay recordatorios pendientes que te resten orden.',
      tone: reminderPoints >= 11 ? 'good' : reminderPoints >= 6 ? 'warn' : 'danger',
    },
  ]

  const score = factors.reduce((sum, factor) => sum + factor.current, 0)
  const status = score >= 80 ? 'fuerte' : score >= 60 ? 'estable' : score >= 40 ? 'atencion' : 'critico'
  const headline =
    status === 'fuerte'
      ? 'Tus decisiones del mes estan sosteniendo bien la salud financiera.'
      : status === 'estable'
        ? 'Vas bien, pero aun hay margen claro para mejorar equilibrio y disciplina.'
        : status === 'atencion'
          ? 'El mes necesita ajustes para no tensionar tu liquidez.'
          : 'Tu panorama actual exige acciones rapidas para recuperar control.'

  const changes: FinancialScoreSummary['changes'] = []

  if (overview.budgetSavings > 0 && overview.totalSavings >= overview.budgetSavings) {
    changes.push({
      label: 'El score sube por ahorro cumplido',
      detail: `Tu ahorro ya cubre la meta mensual y te suma estabilidad.`,
      direction: 'up',
    })
  } else if (overview.budgetSavings > 0) {
    changes.push({
      label: 'El score baja por ahorro incompleto',
      detail: `Te faltan ${formatCurrency(Math.max(0, overview.budgetSavings - overview.totalSavings))} para cerrar la meta.`,
      direction: 'down',
    })
  }

  if (overview.totalExpenses > overview.budgetExpenses || overview.totalWants > overview.budgetWants) {
    changes.push({
      label: 'El score baja por desviacion del presupuesto',
      detail: `Hay consumo por encima del plan en gastos o gustos.`,
      direction: 'down',
    })
  } else {
    changes.push({
      label: 'El score sube por disciplina mensual',
      detail: 'Tus bloques principales siguen dentro de los limites definidos.',
      direction: 'up',
    })
  }

  if (totalDebtRemaining > 0) {
    changes.push({
      label: 'La deuda activa presiona el score',
      detail: `Ahora mismo te quedan ${formatCurrency(totalDebtRemaining)} por cubrir.`,
      direction: 'down',
    })
  } else {
    changes.push({
      label: 'Sin deuda activa',
      detail: 'No tienes pagos pendientes que resten capacidad de maniobra.',
      direction: 'up',
    })
  }

  if (overdueReminders.length > 0 || dueSoonReminders.length > 0) {
    changes.push({
      label: 'Los recordatorios abiertos restan orden',
      detail: `${overdueReminders.length} vencidos y ${dueSoonReminders.length} cercanos requieren atencion.`,
      direction: 'down',
    })
  }

  return {
    score,
    status,
    headline,
    factors,
    changes,
  }
}

export function buildSmartAlerts({
  overview,
  debts,
  reminders,
  wishlist,
}: {
  overview: OverviewLike
  debts: Debt[]
  reminders: Reminder[]
  wishlist: WishlistItem[]
}) {
  const alerts: SmartAlert[] = []
  const activeDebts = debts.filter((item) => !item.isSettled)
  const pendingReminders = reminders.filter((item) => !item.completed)
  const overdueReminders = pendingReminders.filter((item) => getDateDiffInDays(item.date) < 0)
  const dueSoonReminders = pendingReminders.filter((item) => {
    const diff = getDateDiffInDays(item.date)
    return diff >= 0 && diff <= 3
  })
  const totalDebtRemaining = activeDebts.reduce((sum, item) => sum + item.remainingAmount, 0)
  const reachableWishlist = wishlist.filter((item) => !item.isPurchased && item.price > 0 && overview.freeSavings >= item.price)

  if (overview.totalSalary <= 0) {
    alerts.push({
      id: 'missing-salary',
      level: 'critical',
      title: 'Falta registrar el salario del mes',
      description: 'Sin salario la formula pierde precision y el resto del tablero se vuelve menos util.',
      actionLabel: 'Registrar salario',
      href: '/salary',
    })
  }

  if (overdueReminders.length > 0) {
    alerts.push({
      id: 'overdue-reminders',
      level: 'critical',
      title: `Tienes ${overdueReminders.length} recordatorio(s) vencido(s)`,
      description: 'Conviene resolverlos primero porque suelen convertirse en recargos o tareas olvidadas.',
      actionLabel: 'Revisar recordatorios',
      href: '/reminders',
    })
  } else if (dueSoonReminders.length > 0) {
    alerts.push({
      id: 'due-soon-reminders',
      level: 'warning',
      title: `${dueSoonReminders.length} recordatorio(s) vencen pronto`,
      description: 'Todavia estas a tiempo de atenderlos sin que se conviertan en atraso.',
      actionLabel: 'Preparar recordatorios',
      href: '/reminders',
    })
  }

  if (overview.budgetExpenses > 0 && overview.totalExpenses > overview.budgetExpenses) {
    alerts.push({
      id: 'expenses-over-budget',
      level: 'critical',
      title: 'Los gastos ya superaron su presupuesto',
      description: `Vas por ${formatCurrency(overview.totalExpenses)} frente a ${formatCurrency(overview.budgetExpenses)} planificados.`,
      actionLabel: 'Ajustar gastos',
      href: '/expenses',
    })
  }

  if (overview.budgetSavings > 0 && overview.totalSavings < overview.budgetSavings) {
    alerts.push({
      id: 'savings-behind',
      level: 'warning',
      title: 'El ahorro va por debajo de la meta',
      description: `Te faltan ${formatCurrency(Math.max(0, overview.budgetSavings - overview.totalSavings))} para llegar al objetivo del mes.`,
      actionLabel: 'Refuerza ahorro',
      href: '/savings',
    })
  }

  if (activeDebts.length > 0 && overview.totalSalary > 0 && totalDebtRemaining / overview.totalSalary >= 0.35) {
    alerts.push({
      id: 'debt-pressure',
      level: 'warning',
      title: 'La deuda esta presionando demasiado tu ingreso',
      description: `El saldo pendiente equivale a ${Math.round((totalDebtRemaining / overview.totalSalary) * 100)}% del salario actual.`,
      actionLabel: 'Priorizar pagos',
      href: '/debts',
    })
  }

  if (reachableWishlist.length > 0 && overview.freeSavings > 0) {
    alerts.push({
      id: 'wishlist-reachable',
      level: 'success',
      title: `Ya puedes comprar ${reachableWishlist[0].name}`,
      description: `Tus ahorros libres alcanzan para al menos ${reachableWishlist.length} deseo(s) pendiente(s).`,
      actionLabel: 'Ver deseos',
      href: '/wishlist',
    })
  }

  return alerts.slice(0, 5)
}
