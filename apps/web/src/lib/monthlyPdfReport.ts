import {
  getExpenseCategoryLabel,
  getWantCategoryLabel,
  getWishlistReservedAmount,
  isWishlistPurchased,
  parseExpenseDescription,
  parseWantDescription,
  type Debt,
  type Reminder,
  type Transaction,
  type WishlistItem,
} from '@plata/shared'

import { formatMoney, getActiveCurrency } from '@/lib/currency'
import { buildFinancialScore } from '@/lib/financialInsights'

type PdfOverview = {
  totalSalary: number
  totalExpenses: number
  totalWants: number
  totalSavings: number
  freeSavings: number
  budgetExpenses: number
  budgetWants: number
  budgetSavings: number
}

export type MonthlyPdfReportInput = {
  overview: PdfOverview
  transactions: Transaction[]
  wishlist: WishlistItem[]
  debts: Debt[]
  reminders: Reminder[]
  periodStart: string
  generatedAt?: Date
  mode?: 'current' | 'closing'
}

type DistributionRow = { label: string; amount: number }
type Rgb = readonly [number, number, number]

const COLORS = [
  [124, 58, 237],
  [37, 99, 235],
  [16, 185, 129],
  [245, 158, 11],
  [236, 72, 153],
  [14, 165, 233],
] as const

const EXPENSE_LABELS: Record<string, string> = {
  food: 'Alimentación',
  home: 'Hogar',
  gym: 'Gimnasio',
  health: 'Salud',
  essentials: 'Esenciales',
}

const WANT_LABELS: Record<string, string> = {
  outings: 'Salidas',
  shopping: 'Compras',
  gaming: 'Videojuegos',
  subscriptions: 'Suscripciones',
  selfcare: 'Cuidado personal',
}

function groupAmounts(rows: Array<{ label: string; amount: number }>) {
  const grouped = new Map<string, number>()
  rows.forEach((row) => grouped.set(row.label, (grouped.get(row.label) ?? 0) + row.amount))
  return [...grouped.entries()]
    .map(([label, amount]) => ({ label, amount }))
    .filter((row) => row.amount > 0)
    .sort((left, right) => right.amount - left.amount)
}

function scoreMeaning(score: number) {
  if (score >= 85) return { label: 'Excelente', tone: [16, 185, 129] as const, detail: 'Tu mes muestra control, ahorro y buen uso del presupuesto.' }
  if (score >= 70) return { label: 'Bueno', tone: [37, 99, 235] as const, detail: 'La base es saludable, aunque todavía hay margen para optimizar.' }
  if (score >= 50) return { label: 'Requiere atención', tone: [245, 158, 11] as const, detail: 'Hay señales que conviene corregir antes del próximo cierre.' }
  return { label: 'Crítico', tone: [239, 68, 68] as const, detail: 'Prioriza recuperar margen y proteger el ahorro del próximo mes.' }
}

function buildAdvice(overview: PdfOverview, score: ReturnType<typeof buildFinancialScore>) {
  const continueItems: string[] = []
  const improveItems: string[] = []

  if (overview.totalSavings >= overview.budgetSavings && overview.budgetSavings > 0) {
    continueItems.push('Mantén el hábito de ahorro: alcanzaste la meta protegida del mes.')
  } else {
    improveItems.push(`Acerca el ahorro a su meta; todavía faltan ${formatMoney(Math.max(0, overview.budgetSavings - overview.totalSavings))}.`)
  }
  if (overview.totalExpenses <= overview.budgetExpenses) continueItems.push('Conserva el control de gastos esenciales dentro de su límite.')
  else improveItems.push(`Reduce gastos esenciales en ${formatMoney(overview.totalExpenses - overview.budgetExpenses)} para volver al plan.`)
  if (overview.budgetWants > 0 && overview.totalWants > overview.budgetWants) {
    improveItems.push(`Recorta gustos en ${formatMoney(overview.totalWants - overview.budgetWants)} o planifícalos para otro ciclo.`)
  } else if (overview.totalWants > 0) {
    continueItems.push('Los gustos se mantuvieron dentro del espacio previsto por tu fórmula.')
  }
  if (score.factors.find((factor) => factor.key === 'debt')?.tone === 'danger') {
    improveItems.push('Prioriza una deuda activa y dirige hacia ella cualquier margen extraordinario.')
  }

  return {
    continueItems: continueItems.length ? continueItems.slice(0, 3) : ['Sigue registrando los movimientos para mantener una visión financiera completa.'],
    improveItems: improveItems.length ? improveItems.slice(0, 3) : ['Revisa tus metas al inicio del próximo ciclo y mantenlas realistas.'],
  }
}

export async function downloadMonthlyPdfReport(input: MonthlyPdfReportInput) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const generatedAt = input.generatedAt ?? new Date()
  const periodStart = input.periodStart.slice(0, 10)
  const activeCurrency = getActiveCurrency()
  const currentTransactions = input.transactions.filter((transaction) => transaction.date.slice(0, 10) >= periodStart)
  const checkedExpenses = currentTransactions.filter((transaction) =>
    transaction.type === 'expense' && parseExpenseDescription(transaction.description).status === 'checked'
  )
  const checkedWants = currentTransactions.filter((transaction) =>
    transaction.type === 'want' && parseWantDescription(transaction.description).status === 'checked'
  )
  const purchasedWishes = input.wishlist.filter((item) =>
    isWishlistPurchased(item) && Boolean(item.purchasedAt) && item.purchasedAt!.slice(0, 10) >= periodStart
  )
  const expenses = groupAmounts(checkedExpenses.map((transaction) => ({
    label: getExpenseCategoryLabel(parseExpenseDescription(transaction.description).category)
      ?? EXPENSE_LABELS[parseExpenseDescription(transaction.description).category]
      ?? 'Otros gastos',
    amount: transaction.amount,
  })))
  const wants = groupAmounts(checkedWants.map((transaction) => ({
    label: getWantCategoryLabel(parseWantDescription(transaction.description).category)
      ?? WANT_LABELS[parseWantDescription(transaction.description).category]
      ?? 'Otros gustos',
    amount: transaction.amount,
  })))
  const wishSavings = purchasedWishes.map((item) => ({ label: `Deseo: ${item.name}`, amount: getWishlistReservedAmount(item) }))
  const reservedForWishes = wishSavings.reduce((sum, row) => sum + row.amount, 0)
  const savings = groupAmounts([
    { label: 'Ahorro conservado', amount: Math.max(0, input.overview.totalSavings - reservedForWishes) },
    ...wishSavings,
  ])
  const financialScore = buildFinancialScore({ overview: input.overview, debts: input.debts, reminders: input.reminders })
  const meaning = scoreMeaning(financialScore.score)
  const advice = buildAdvice(input.overview, financialScore)

  const pageWidth = 210
  const margin = 17
  const contentWidth = pageWidth - margin * 2
  const ink = [30, 30, 38] as const
  const muted = [100, 105, 120] as const
  const purple = [124, 58, 237] as const

  function text(value: string, x: number, y: number, options?: { size?: number; color?: Rgb; style?: 'normal' | 'bold'; maxWidth?: number; align?: 'left' | 'center' | 'right' }) {
    doc.setFont('helvetica', options?.style ?? 'normal')
    doc.setFontSize(options?.size ?? 10)
    const color = options?.color ?? ink
    doc.setTextColor(color[0], color[1], color[2])
    const lines = options?.maxWidth ? doc.splitTextToSize(value, options.maxWidth) : value
    doc.text(lines, x, y, { align: options?.align ?? 'left' })
    return Array.isArray(lines) ? lines.length * ((options?.size ?? 10) * 0.42) : 4
  }

  function pageHeader(title: string, subtitle: string) {
    doc.setFillColor(248, 247, 252)
    doc.rect(0, 0, 210, 297, 'F')
    doc.setFillColor(purple[0], purple[1], purple[2])
    doc.roundedRect(margin, 14, 10, 10, 3, 3, 'F')
    text('P', margin + 3.1, 21.2, { size: 10, color: [255, 255, 255], style: 'bold' })
    text('PLATA APP', margin + 14, 20.5, { size: 8, color: purple, style: 'bold' })
    text(title, margin, 39, { size: 23, style: 'bold' })
    text(subtitle, margin, 47, { size: 9.5, color: muted })
    doc.setDrawColor(224, 221, 232)
    doc.line(margin, 53, 210 - margin, 53)
  }

  function metricCard(x: number, y: number, width: number, label: string, value: string, accent: Rgb = purple) {
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(228, 225, 235)
    doc.roundedRect(x, y, width, 25, 3, 3, 'FD')
    doc.setFillColor(accent[0], accent[1], accent[2])
    doc.roundedRect(x, y, 2.5, 25, 1, 1, 'F')
    text(label.toUpperCase(), x + 7, y + 8, { size: 7, color: muted, style: 'bold' })
    text(value, x + 7, y + 18, { size: 13, style: 'bold' })
  }

  function distributionChart(rows: DistributionRow[], y: number) {
    const max = Math.max(...rows.map((row) => row.amount), 1)
    const total = rows.reduce((sum, row) => sum + row.amount, 0)
    text('Distribución por categoría', margin, y, { size: 13, style: 'bold' })
    text(`${rows.length} categorías con movimiento`, margin, y + 7, { size: 8.5, color: muted })
    let cursor = y + 18
    rows.slice(0, 7).forEach((row, index) => {
      const color = COLORS[index % COLORS.length]
      text(row.label, margin, cursor, { size: 8.5, style: 'bold', maxWidth: 70 })
      text(`${Math.round((row.amount / total) * 100)}%`, 112, cursor, { size: 8, color: muted })
      text(formatMoney(row.amount), 193, cursor, { size: 8.5, style: 'bold', align: 'right' })
      doc.setFillColor(229, 227, 235)
      doc.roundedRect(margin, cursor + 4, contentWidth, 4, 2, 2, 'F')
      doc.setFillColor(color[0], color[1], color[2])
      doc.roundedRect(margin, cursor + 4, Math.max(3, contentWidth * (row.amount / max)), 4, 2, 2, 'F')
      cursor += 17
    })
    return cursor
  }

  function addDistributionPage(title: string, subtitle: string, rows: DistributionRow[], totalLabel: string, budget?: number) {
    doc.addPage()
    pageHeader(title, subtitle)
    const total = rows.reduce((sum, row) => sum + row.amount, 0)
    metricCard(margin, 61, 55, totalLabel, formatMoney(total))
    metricCard(77, 61, 55, 'Movimientos', String(rows.length), COLORS[1])
    metricCard(138, 61, 55, budget === undefined ? 'Moneda' : 'Presupuesto', budget === undefined ? activeCurrency.code : formatMoney(budget), COLORS[2])
    const chartEnd = distributionChart(rows, 101)
    const leader = rows[0]
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(228, 225, 235)
    doc.roundedRect(margin, Math.min(247, chartEnd + 3), contentWidth, 24, 3, 3, 'FD')
    text('Mayor concentración', margin + 6, Math.min(258, chartEnd + 14), { size: 8, color: muted, style: 'bold' })
    text(`${leader.label}: ${formatMoney(leader.amount)}`, 188, Math.min(258, chartEnd + 14), { size: 10, color: purple, style: 'bold', align: 'right' })
  }

  pageHeader(
    input.mode === 'closing' ? 'Informe de cierre mensual' : 'Informe financiero actual',
    `${new Date(`${periodStart}T12:00:00`).toLocaleDateString('es-ES')} - ${generatedAt.toLocaleDateString('es-ES')} · Valores en ${activeCurrency.code}`,
  )
  metricCard(margin, 61, 55, 'Salario del mes', formatMoney(input.overview.totalSalary))
  metricCard(77, 61, 55, 'Score financiero', `${financialScore.score}/100`, meaning.tone)
  metricCard(138, 61, 55, 'Ahorro del mes', formatMoney(input.overview.totalSavings), COLORS[2])

  doc.setFillColor(meaning.tone[0], meaning.tone[1], meaning.tone[2])
  doc.roundedRect(margin, 96, contentWidth, 29, 3, 3, 'F')
  text(`Resultado: ${meaning.label}`, margin + 7, 107, { size: 14, color: [255, 255, 255], style: 'bold' })
  text(meaning.detail, margin + 7, 116, { size: 9, color: [255, 255, 255], maxWidth: contentWidth - 14 })

  text('Resumen del mes', margin, 142, { size: 14, style: 'bold' })
  text(
    `Ingresaste ${formatMoney(input.overview.totalSalary)}, destinaste ${formatMoney(input.overview.totalExpenses)} a gastos, ${formatMoney(input.overview.totalWants)} a gustos y registraste ${formatMoney(input.overview.totalSavings)} en ahorros.`,
    margin,
    151,
    { size: 9.5, color: muted, maxWidth: contentWidth },
  )
  text('Qué debes seguir haciendo', margin, 177, { size: 12, color: COLORS[2], style: 'bold' })
  advice.continueItems.forEach((item, index) => text(`- ${item}`, margin + 2, 187 + index * 10, { size: 9, maxWidth: contentWidth - 4 }))
  text('Qué debes mejorar', margin, 224, { size: 12, color: [239, 68, 68], style: 'bold' })
  advice.improveItems.forEach((item, index) => text(`- ${item}`, margin + 2, 234 + index * 10, { size: 9, maxWidth: contentWidth - 4 }))

  if (expenses.length) addDistributionPage('Gastos del mes', 'Cuánto gastaste y cómo se distribuyó entre categorías.', expenses, 'Total gastado', input.overview.budgetExpenses)
  if (wants.length) addDistributionPage('Gustos del mes', 'Distribución del consumo flexible y experiencias del período.', wants, 'Total en gustos', input.overview.budgetWants)
  if (savings.length && savings.some((row) => row.amount > 0)) {
    addDistributionPage('Ahorros y deseos', 'Ahorro conservado y deseos comprados con el dinero reservado.', savings, 'Ahorro gestionado', input.overview.budgetSavings)
  }

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(muted[0], muted[1], muted[2])
    doc.text(`Generado por Plata App · ${generatedAt.toLocaleString('es-ES')}`, margin, 289)
    doc.text(`Página ${page} de ${pages}`, 193, 289, { align: 'right' })
  }

  const monthKey = generatedAt.toISOString().slice(0, 7)
  doc.save(`informe-financiero-${monthKey}.pdf`)
}
