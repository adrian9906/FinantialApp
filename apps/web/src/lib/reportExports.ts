import {
  getMonthlyOverview,
  getFinancialPeriodStart,
  isInFinancialPeriod,
  getWishlistExternalContribution,
  getWishlistReservedAmount,
  isWishlistPurchased,
  type Debt,
  type MonthlyPlanningHistory,
  type Projection,
  type Reminder,
  type Salary,
  type Transaction,
  type WishlistItem,
  type AppEvent,
} from '@plata/shared'

import { parseExpenseDescription } from '@/lib/expense-utils'
import { downloadExcelWorkbook, type ExcelSheetDefinition } from '@/lib/excel'
import {
  buildMonthComparison,
  buildSnapshotTransactions,
  buildMonthlyRankings,
  buildMonthlySummaries,
  getMonthKey,
  getPreviousMonthKey,
} from '@/lib/reporting'
import { parseWantDescription } from '@/lib/want-utils'
import { convertFromUsd } from '@/lib/currency'

function toCurrency(value: number) {
  return Math.round(convertFromUsd(value) * 100) / 100
}

export async function exportExpensesReport(transactions: Transaction[]) {
  const rows = transactions
    .filter((transaction) => transaction.type === 'expense')
    .map((transaction) => {
      const parsed = parseExpenseDescription(transaction.description)
      return [
        transaction.date,
        parsed.itemName,
        parsed.category,
        parsed.status,
        toCurrency(transaction.amount),
      ]
    })

  await downloadExcelWorkbook(`informe-gastos-${getMonthKey(new Date())}.xlsx`, [
    {
      name: 'Gastos',
      columns: ['Fecha', 'Item', 'Categoria', 'Estado', 'Monto'],
      rows,
    },
  ])
}

export async function exportWantsReport(transactions: Transaction[]) {
  const rows = transactions
    .filter((transaction) => transaction.type === 'want')
    .map((transaction) => {
      const parsed = parseWantDescription(transaction.description)
      return [
        transaction.date,
        parsed.itemName,
        parsed.category,
        parsed.status,
        toCurrency(transaction.amount),
      ]
    })

  await downloadExcelWorkbook(`informe-gustos-${getMonthKey(new Date())}.xlsx`, [
    {
      name: 'Gustos',
      columns: ['Fecha', 'Item', 'Categoria', 'Estado', 'Monto'],
      rows,
    },
  ])
}

export async function exportWishlistReport(wishlist: WishlistItem[]) {
  const rows = wishlist.map((item) => [
    item.name,
    toCurrency(item.price),
    item.priority,
    isWishlistPurchased(item) ? 'comprado' : 'pendiente',
    toCurrency(item.savedAmount),
    toCurrency(getWishlistExternalContribution(item)),
    toCurrency(getWishlistReservedAmount(item)),
  ])

  await downloadExcelWorkbook(`informe-deseos-${getMonthKey(new Date())}.xlsx`, [
    {
      name: 'Deseos',
      columns: ['Nombre', 'Precio', 'Prioridad', 'Estado', 'Ahorro usado', 'Aporte externo', 'Descontado real'],
      rows,
    },
  ])
}

export async function exportSalariesReport(salaries: Salary[]) {
  await downloadExcelWorkbook(`informe-salarios-${getMonthKey(new Date())}.xlsx`, [
    {
      name: 'Ingresos',
      columns: ['Mes', 'Monto'],
      rows: salaries.map((salary) => [salary.month, toCurrency(salary.amount)]),
    },
  ])
}

export async function exportSavingsReport(transactions: Transaction[]) {
  await downloadExcelWorkbook(`informe-ahorros-${getMonthKey(new Date())}.xlsx`, [
    {
      name: 'Ahorros',
      columns: ['Fecha', 'Descripcion', 'Monto'],
      rows: transactions
        .filter((transaction) => transaction.type === 'saving')
        .map((transaction) => [transaction.date, transaction.description ?? 'Ahorro', toCurrency(transaction.amount)]),
    },
  ])
}

export async function exportDebtsReport(debts: Debt[]) {
  await downloadExcelWorkbook(`informe-deudas-${getMonthKey(new Date())}.xlsx`, [
    {
      name: 'Deudas',
      columns: ['Concepto', 'Monto total', 'Pagado', 'Pendiente', 'Inicio', 'Fin', 'Estado'],
      rows: debts.map((debt) => [
        debt.history,
        toCurrency(debt.amount),
        toCurrency(debt.paidAmount),
        toCurrency(debt.remainingAmount),
        debt.startDate,
        debt.endDate,
        debt.isSettled ? 'saldada' : 'activa',
      ]),
    },
  ])
}

export async function exportEventsReport(events: AppEvent[]) {
  await downloadExcelWorkbook(`informe-eventos-${getMonthKey(new Date())}.xlsx`, [
    {
      name: 'Eventos',
      columns: ['Nombre', 'Fecha', 'Monto', 'Notificacion'],
      rows: events.map((event) => [event.name, event.date, toCurrency(event.amount), event.isNotification ? 'si' : 'no']),
    },
  ])
}

export async function exportRemindersReport(reminders: Reminder[]) {
  await downloadExcelWorkbook(`informe-recordatorios-${getMonthKey(new Date())}.xlsx`, [
    {
      name: 'Recordatorios',
      columns: ['Titulo', 'Descripcion', 'Fecha', 'Estado'],
      rows: reminders.map((reminder) => [reminder.title, reminder.description, reminder.date, reminder.completed ? 'completado' : 'pendiente']),
    },
  ])
}

export async function exportProjectionsReport(projections: Projection[]) {
  await downloadExcelWorkbook(`informe-proyecciones-${getMonthKey(new Date())}.xlsx`, [
    {
      name: 'Proyecciones',
      columns: ['Ingreso meta'],
      rows: projections.map((projection) => [toCurrency(projection.targetSalary)]),
    },
  ])
}

export async function exportMonthlyReport(params: {
  salaries: Salary[]
  transactions: Transaction[]
  debts: Debt[]
  wishlist: WishlistItem[]
  events: AppEvent[]
  monthlyPlanningHistory: MonthlyPlanningHistory[]
  formula: import('@plata/shared').AllocationFormula
  incomeSourceId?: string
}) {
  const { salaries, transactions, debts, wishlist, events, monthlyPlanningHistory, formula, incomeSourceId } = params
  const currentMonthKey = getMonthKey(new Date())
  const currentPeriodEnd = new Date().toISOString().slice(0, 10)
  const previousMonthKey = getPreviousMonthKey(currentMonthKey)
  const currentPeriodStart = getFinancialPeriodStart(monthlyPlanningHistory)
  const closedCycles = [...monthlyPlanningHistory]
    .filter((entry) => Number.isFinite(Date.parse(entry.createdAt)) && Date.parse(entry.createdAt) <= Date.now())
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
  const latestClosedCycle = closedCycles[0]
  const previousPeriodStart = closedCycles[1]?.createdAt ?? `${latestClosedCycle?.month ?? previousMonthKey}-01T00:00:00.000Z`
  const currentTransactions = transactions.filter((transaction) => isInFinancialPeriod(transaction, currentPeriodStart, true) && transaction.date.slice(0, 10) <= currentPeriodEnd)
  const previousTransactions = buildSnapshotTransactions(latestClosedCycle)
    .filter((transaction) => !incomeSourceId || transaction.incomeSourceId === incomeSourceId)

  const currentOverview = getMonthlyOverview(salaries, transactions, debts, formula, {
    periodStart: currentPeriodStart,
    periodEnd: currentPeriodEnd,
    salaryMonth: currentMonthKey,
    strictSameDayBoundary: true,
  })
  const previousOverview = getMonthlyOverview(salaries, previousTransactions, [], formula, {
    periodStart: previousPeriodStart,
    salaryMonth: latestClosedCycle?.month ?? previousMonthKey,
  })
  const monthlySummaries = buildMonthlySummaries({
    salaries,
    transactions,
    debts,
    monthlyPlanningHistory,
    formula,
    incomeSourceId,
  })
  const currentSummaryBase = monthlySummaries.find((entry) => entry.month === currentMonthKey)
  const previousSummaryBase = monthlySummaries.find((entry) => entry.month === (latestClosedCycle?.month ?? previousMonthKey))
  const currentSummary = currentSummaryBase ? { ...currentSummaryBase, salary: currentOverview.totalSalary, expenses: currentOverview.totalExpenses, wants: currentOverview.totalWants, savings: currentOverview.totalSavings, debtPaid: currentOverview.totalDebtPaid, freeBalance: Math.max(0, currentOverview.totalSalary - currentOverview.totalExpenses - currentOverview.totalWants - currentOverview.totalSavings) } : undefined
  const previousSummary = previousSummaryBase ? { ...previousSummaryBase, salary: previousOverview.totalSalary, expenses: previousOverview.totalExpenses, wants: previousOverview.totalWants, savings: previousOverview.totalSavings, freeBalance: Math.max(0, previousOverview.totalSalary - previousOverview.totalExpenses - previousOverview.totalWants - previousOverview.totalSavings) } : undefined
  const filteredSummaries = [previousSummary, currentSummary].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
  const comparisonRows = buildMonthComparison(currentSummary, previousSummary)
  const currentRankings = buildMonthlyRankings(transactions, currentMonthKey, currentPeriodStart, currentPeriodEnd)
  const previousRankings = buildMonthlyRankings(previousTransactions, latestClosedCycle?.month ?? previousMonthKey)
  const filteredTransactions = [...previousTransactions, ...currentTransactions]
  const filteredEvents = events.filter((event) => event.date >= previousPeriodStart.slice(0, 10))
  const filteredHistory = closedCycles.slice(0, 2).map((entry) => ({
    ...entry,
    expenses: entry.expenses.filter((item) => !incomeSourceId || item.incomeSourceId === incomeSourceId),
    wants: entry.wants.filter((item) => !incomeSourceId || item.incomeSourceId === incomeSourceId),
  }))
  const reservedForPurchasedWishlist = wishlist.reduce(
    (sum, item) => sum + (isWishlistPurchased(item) ? getWishlistReservedAmount(item) : 0),
    0,
  )

  const sheets: ExcelSheetDefinition[] = [
    {
      name: 'Resumen',
      columns: ['Indicador', 'Ciclo actual', 'Ciclo anterior', 'Objetivo'],
      rows: [
        ['Ingresos', toCurrency(currentOverview.grossSalary), toCurrency(previousOverview.grossSalary), ''],
        ['Gastos', toCurrency(currentOverview.totalExpenses), toCurrency(previousOverview.totalExpenses), toCurrency(currentOverview.budgetExpenses)],
        ['Gustos', toCurrency(currentOverview.totalWants), toCurrency(previousOverview.totalWants), toCurrency(currentOverview.budgetWants)],
        ['Ahorros', toCurrency(Math.max(0, currentOverview.totalSavings - reservedForPurchasedWishlist)), toCurrency(previousOverview.totalSavings), toCurrency(currentOverview.budgetSavings)],
        ['Deuda pagada acumulada', toCurrency(debts.reduce((sum, debt) => sum + debt.paidAmount, 0)), '', ''],
        ['Deuda pendiente actual', toCurrency(debts.reduce((sum, debt) => sum + debt.remainingAmount, 0)), '', ''],
      ],
    },
    {
      name: 'Comparador por ciclo',
      columns: ['Indicador', 'Ciclo actual', 'Ciclo anterior', 'Variacion', 'Variacion %', 'Meta'],
      rows: comparisonRows.map((row) => [
        row.label,
        toCurrency(row.current),
        toCurrency(row.previous),
        toCurrency(row.delta),
        row.percent,
        row.budget ? toCurrency(row.budget) : '',
      ]),
    },
    {
      name: 'Tendencias',
      columns: ['Ciclo', 'Ingresos', 'Gastos', 'Gustos', 'Ahorros', 'Deuda pagada', 'Deuda pendiente', 'Saldo libre'],
      rows: filteredSummaries.map((summary) => [
        summary.label,
        toCurrency(summary.salary),
        toCurrency(summary.expenses),
        toCurrency(summary.wants),
        toCurrency(summary.savings),
        toCurrency(summary.debtPaid),
        toCurrency(summary.debtRemaining),
        toCurrency(summary.freeBalance),
      ]),
    },
    {
      name: 'Top categorías actual',
      columns: ['Categoria', 'Tipo', 'Monto total', 'Repeticiones'],
      rows: currentRankings.topCategoriesByAmount.map((entry) => [
        entry.label,
        entry.type === 'expense' ? 'gasto' : 'gusto',
        toCurrency(entry.totalAmount),
        entry.count,
      ]),
    },
    {
      name: 'Top productos anterior',
      columns: ['Producto', 'Categoria', 'Tipo', 'Monto total', 'Repeticiones'],
      rows: previousRankings.topProductsByAmount.map((entry) => [
        entry.label,
        entry.category,
        entry.type === 'expense' ? 'gasto' : 'gusto',
        toCurrency(entry.totalAmount),
        entry.count,
      ]),
    },
    {
      name: 'Movimientos',
      columns: ['Fecha', 'Tipo', 'Descripcion', 'Monto'],
      rows: filteredTransactions.map((transaction) => [transaction.date, transaction.type, transaction.description ?? '', toCurrency(transaction.amount)]),
    },
    {
      name: 'Eventos',
      columns: ['Nombre', 'Fecha', 'Monto'],
      rows: filteredEvents.map((event) => [event.name, event.date, toCurrency(event.amount)]),
    },
    {
      name: 'Cierres',
      columns: ['Mes', 'Etiqueta', 'Gastos guardados', 'Gustos guardados', 'Creado'],
      rows: filteredHistory.map((entry) => [entry.month, entry.label, entry.expenses.length, entry.wants.length, entry.createdAt]),
    },
  ]

  await downloadExcelWorkbook(`reporte-ciclo-${currentPeriodStart.slice(0, 10)}.xlsx`, sheets)
}
