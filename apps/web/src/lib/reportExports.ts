import {
  getMonthlyOverview,
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
  buildMonthlyRankings,
  buildMonthlySummaries,
  getMonthKey,
  getPreviousMonthKey,
} from '@/lib/reporting'
import { parseWantDescription } from '@/lib/want-utils'

function toCurrency(value: number) {
  return Math.round(value * 100) / 100
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
      name: 'Salarios',
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
      columns: ['Salario meta'],
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
}) {
  const { salaries, transactions, debts, wishlist, events, monthlyPlanningHistory, formula } = params
  const currentMonthKey = getMonthKey(new Date())
  const previousMonthKey = getPreviousMonthKey(currentMonthKey)

  const currentSalaries = salaries.filter((salary) => salary.month === currentMonthKey)
  const previousSalaries = salaries.filter((salary) => salary.month === previousMonthKey)
  const currentTransactions = transactions.filter((transaction) => transaction.date.slice(0, 7) === currentMonthKey)
  const previousTransactions = transactions.filter((transaction) => transaction.date.slice(0, 7) === previousMonthKey)

  const currentOverview = getMonthlyOverview(currentSalaries, currentTransactions, [], formula)
  const previousOverview = getMonthlyOverview(previousSalaries, previousTransactions, [], formula)
  const monthlySummaries = buildMonthlySummaries({
    salaries,
    transactions,
    debts,
    monthlyPlanningHistory,
    formula,
  })
  const currentSummary = monthlySummaries.find((entry) => entry.month === currentMonthKey)
  const previousSummary = monthlySummaries.find((entry) => entry.month === previousMonthKey)
  const comparisonRows = buildMonthComparison(currentSummary, previousSummary)
  const rankings = buildMonthlyRankings(transactions, currentMonthKey)
  const reservedForPurchasedWishlist = wishlist.reduce(
    (sum, item) => sum + (isWishlistPurchased(item) ? getWishlistReservedAmount(item) : 0),
    0,
  )

  const sheets: ExcelSheetDefinition[] = [
    {
      name: 'Resumen',
      columns: ['Indicador', 'Actual', 'Mes anterior', 'Objetivo'],
      rows: [
        ['Salario', toCurrency(currentOverview.grossSalary), toCurrency(previousOverview.grossSalary), ''],
        ['Gastos', toCurrency(currentOverview.totalExpenses), toCurrency(previousOverview.totalExpenses), toCurrency(currentOverview.budgetExpenses)],
        ['Gustos', toCurrency(currentOverview.totalWants), toCurrency(previousOverview.totalWants), toCurrency(currentOverview.budgetWants)],
        ['Ahorros', toCurrency(Math.max(0, currentOverview.totalSavings - reservedForPurchasedWishlist)), toCurrency(previousOverview.totalSavings), toCurrency(currentOverview.budgetSavings)],
        ['Deuda pagada acumulada', toCurrency(debts.reduce((sum, debt) => sum + debt.paidAmount, 0)), '', ''],
        ['Deuda pendiente actual', toCurrency(debts.reduce((sum, debt) => sum + debt.remainingAmount, 0)), '', ''],
      ],
    },
    {
      name: 'Comparador mensual',
      columns: ['Indicador', 'Mes actual', 'Mes anterior', 'Variacion', 'Variacion %', 'Meta'],
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
      columns: ['Mes', 'Salario', 'Gastos', 'Gustos', 'Ahorros', 'Deuda pagada', 'Deuda pendiente', 'Saldo libre'],
      rows: monthlySummaries.map((summary) => [
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
      name: 'Top categorias',
      columns: ['Categoria', 'Tipo', 'Monto total', 'Repeticiones'],
      rows: rankings.topCategoriesByAmount.map((entry) => [
        entry.label,
        entry.type === 'expense' ? 'gasto' : 'gusto',
        toCurrency(entry.totalAmount),
        entry.count,
      ]),
    },
    {
      name: 'Top productos',
      columns: ['Producto', 'Categoria', 'Tipo', 'Monto total', 'Repeticiones'],
      rows: rankings.topProductsByAmount.map((entry) => [
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
      rows: transactions.map((transaction) => [transaction.date, transaction.type, transaction.description ?? '', toCurrency(transaction.amount)]),
    },
    {
      name: 'Eventos',
      columns: ['Nombre', 'Fecha', 'Monto'],
      rows: events.map((event) => [event.name, event.date, toCurrency(event.amount)]),
    },
    {
      name: 'Cierres',
      columns: ['Mes', 'Etiqueta', 'Gastos guardados', 'Gustos guardados', 'Creado'],
      rows: monthlyPlanningHistory.map((entry) => [entry.month, entry.label, entry.expenses.length, entry.wants.length, entry.createdAt]),
    },
  ]

  await downloadExcelWorkbook(`reporte-mensual-${currentMonthKey}.xlsx`, sheets)
}
