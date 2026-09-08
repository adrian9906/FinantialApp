import {
  getExpenseCategoryLabel,
  getWantCategoryLabel,
  getWishlistReservedAmount,
  isWishlistPurchased,
  parseExpenseDescription,
  parseWantDescription,
  type AppEvent,
  type Debt,
  type MonthlyPlanningHistory,
  type Reminder,
  type Salary,
  type Transaction,
  type WishlistItem,
} from '@plata/shared'

import { formatMoney, getActiveCurrency } from '@/lib/currency'
import { buildFinancialScore } from '@/lib/financialInsights'
import { buildUnnecessarySpendingInsights } from '@/lib/unnecessary-spending'

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
  salaries?: Salary[]
  events?: AppEvent[]
  monthlyPlanningHistory?: MonthlyPlanningHistory[]
  periodStart: string
  userName: string
  generatedAt?: Date
  mode?: 'current' | 'closing'
  output?: 'download' | 'arraybuffer'
}

type DistributionRow = { label: string; amount: number }
type Rgb = readonly [number, number, number]

type PdfTheme = {
  background: Rgb
  surface: Rgb
  elevated: Rgb
  border: Rgb
  text: Rgb
  muted: Rgb
  primary: Rgb
  primarySoft: Rgb
  secondary: Rgb
}

const COLORS = [
  [124, 58, 237],
  [37, 99, 235],
  [16, 185, 129],
  [245, 158, 11],
  [236, 72, 153],
  [14, 165, 233],
] as const

const CYCLE_LABEL_FORMATTER = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' })

const DEFAULT_THEME: PdfTheme = {
  background: [23, 23, 23],
  surface: [30, 30, 30],
  elevated: [42, 42, 42],
  border: [63, 63, 63],
  text: [229, 226, 225],
  muted: [163, 163, 163],
  primary: [124, 58, 237],
  primarySoft: [210, 187, 255],
  secondary: [206, 189, 255],
}

function parseCssColor(value: string, fallback: Rgb): Rgb {
  const normalized = value.trim()
  const hex = normalized.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i)
  if (hex) return [Number.parseInt(hex[1], 16), Number.parseInt(hex[2], 16), Number.parseInt(hex[3], 16)]

  const rgb = normalized.match(/^rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)/i)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]

  return fallback
}

function readPdfTheme(): PdfTheme {
  if (typeof window === 'undefined') return DEFAULT_THEME
  const styles = getComputedStyle(document.documentElement)
  const color = (name: string, fallback: Rgb) => parseCssColor(styles.getPropertyValue(name), fallback)

  return {
    background: color('--abyss', DEFAULT_THEME.background),
    surface: color('--surface', DEFAULT_THEME.surface),
    elevated: color('--surface-container-high', DEFAULT_THEME.elevated),
    border: color('--graphite', DEFAULT_THEME.border),
    text: color('--on-surface', DEFAULT_THEME.text),
    muted: color('--muted-gray', DEFAULT_THEME.muted),
    primary: color('--primary-container', DEFAULT_THEME.primary),
    primarySoft: color('--primary', DEFAULT_THEME.primarySoft),
    secondary: color('--secondary', DEFAULT_THEME.secondary),
  }
}

async function loadLogoDataUrl() {
  if (typeof window === 'undefined') return null

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}favicon-96x96.png`)
    if (!response.ok) return null
    const blob = await response.blob()

    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

const EXPENSE_LABELS: Record<string, string> = {
  food: 'Alimentación',
  home: 'Hogar',
  services: 'Servicios',
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

function groupCounts(labels: string[]) {
  const grouped = new Map<string, number>()
  labels.forEach((label) => grouped.set(label, (grouped.get(label) ?? 0) + 1))
  return [...grouped.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count)
}

function scoreMeaning(score: number) {
  if (score >= 85) return { label: 'Excelente', tone: [16, 185, 129] as const, detail: 'Tu ciclo muestra control, ahorro y buen uso del presupuesto.' }
  if (score >= 70) return { label: 'Bueno', tone: [37, 99, 235] as const, detail: 'La base es saludable, aunque todavía hay margen para optimizar.' }
  if (score >= 50) return { label: 'Requiere atención', tone: [245, 158, 11] as const, detail: 'Hay señales que conviene corregir antes del próximo cierre.' }
  return { label: 'Crítico', tone: [239, 68, 68] as const, detail: 'Prioriza recuperar margen y proteger el ahorro del próximo ciclo.' }
}

function buildAdvice(overview: PdfOverview, score: ReturnType<typeof buildFinancialScore>) {
  const continueItems: string[] = []
  const improveItems: string[] = []

  if (overview.totalSavings >= overview.budgetSavings && overview.budgetSavings > 0) {
    continueItems.push('Mantén el hábito de ahorro: alcanzaste la meta protegida del ciclo.')
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
  const [theme, logoDataUrl] = await Promise.all([Promise.resolve(readPdfTheme()), loadLogoDataUrl()])
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const generatedAt = input.generatedAt ?? new Date()
  const periodStart = input.periodStart.slice(0, 10)
  const periodStartDate = new Date(`${periodStart}T12:00:00`)
  const periodLabel = `${periodStartDate.toLocaleDateString('es-ES')} - ${generatedAt.toLocaleDateString('es-ES')}`
  const activeCurrency = getActiveCurrency()
  const periodEnd = generatedAt.toISOString().slice(0, 10)
  const currentTransactions = input.transactions.filter((transaction) => (
    transaction.date.slice(0, 10) >= periodStart && transaction.date.slice(0, 10) <= periodEnd
  ))
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
  const products = groupAmounts([
    ...checkedExpenses.map((transaction) => ({
      label: parseExpenseDescription(transaction.description).itemName || 'Gasto sin nombre',
      amount: transaction.amount,
    })),
    ...checkedWants.map((transaction) => ({
      label: parseWantDescription(transaction.description).itemName || 'Gusto sin nombre',
      amount: transaction.amount,
    })),
  ])
  const wishSavings = purchasedWishes.map((item) => ({ label: `Deseo: ${item.name}`, amount: getWishlistReservedAmount(item) }))
  const reservedForWishes = wishSavings.reduce((sum, row) => sum + row.amount, 0)
  const savings = groupAmounts([
    { label: 'Ahorro conservado', amount: Math.max(0, input.overview.totalSavings - reservedForWishes) },
    ...wishSavings,
  ])
  const unnecessaryInsights = buildUnnecessarySpendingInsights(currentTransactions, periodStart.slice(0, 7), input.periodStart, periodEnd)
  const financialScore = buildFinancialScore({
    overview: input.overview,
    debts: input.debts,
    reminders: input.reminders,
    unnecessarySpending: unnecessaryInsights,
  })
  const meaning = scoreMeaning(financialScore.score)
  const advice = buildAdvice(input.overview, financialScore)
  const closedCycles = [...(input.monthlyPlanningHistory ?? [])]
    .filter((cycle) => Number.isFinite(Date.parse(cycle.createdAt)) && Date.parse(cycle.createdAt) <= Date.parse(input.periodStart))
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
  const previousCycle = closedCycles.at(-1)
  const previousExpenses = previousCycle?.expenses
    .filter((entry) => entry.status === 'checked')
    .reduce((sum, entry) => sum + entry.amount, 0) ?? 0
  const previousWants = previousCycle?.wants
    .filter((entry) => entry.status === 'checked')
    .reduce((sum, entry) => sum + entry.amount, 0) ?? 0
  const trendSeries = [
    ...closedCycles.map((cycle) => ({
      label: CYCLE_LABEL_FORMATTER.format(new Date(cycle.createdAt)).replace('.', ''),
      expenses: cycle.expenses.filter((entry) => entry.status === 'checked').reduce((sum, entry) => sum + entry.amount, 0),
      wants: cycle.wants.filter((entry) => entry.status === 'checked').reduce((sum, entry) => sum + entry.amount, 0),
    })),
    { label: 'Actual', expenses: input.overview.totalExpenses, wants: input.overview.totalWants },
  ].slice(-8)
  const repeatedCurrentCategories = groupCounts([
    ...checkedExpenses.map((transaction) => getExpenseCategoryLabel(parseExpenseDescription(transaction.description).category) ?? 'Otros gastos'),
    ...checkedWants.map((transaction) => getWantCategoryLabel(parseWantDescription(transaction.description).category) ?? 'Otros gustos'),
  ])
  const repeatedPreviousProducts = groupCounts([
    ...(previousCycle?.expenses ?? []).filter((entry) => entry.status === 'checked').map((entry) => entry.itemName),
    ...(previousCycle?.wants ?? []).filter((entry) => entry.status === 'checked').map((entry) => entry.itemName),
  ])

  const pageWidth = 210
  const margin = 17
  const contentWidth = pageWidth - margin * 2
  const ink = theme.text
  const muted = theme.muted
  const purple = theme.primary

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
    doc.setFillColor(...theme.background)
    doc.rect(0, 0, 210, 297, 'F')
    doc.setFillColor(...theme.surface)
    doc.setDrawColor(...theme.border)
    doc.roundedRect(margin, 12, contentWidth, 25, 4, 4, 'FD')

    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', margin + 3, 15, 18, 18, undefined, 'FAST')
    } else {
      doc.setFillColor(...purple)
      doc.circle(margin + 12, 24.5, 7, 'F')
      text('P', margin + 9.4, 27.2, { size: 10, color: [255, 255, 255], style: 'bold' })
    }

    text('PLATA APP', margin + 25, 22, { size: 9, color: theme.primarySoft, style: 'bold' })
    text(input.mode === 'closing' ? 'CIERRE DEL CICLO' : 'REPORTE EN CURSO', margin + 25, 28.5, { size: 6.8, color: muted, style: 'bold' })
    text(input.userName || 'Usuario', pageWidth - margin - 5, 21.5, { size: 10, style: 'bold', align: 'right' })
    text(`Período: ${periodLabel}`, pageWidth - margin - 5, 28.5, { size: 7.5, color: muted, align: 'right' })

    text(title, margin, 52, { size: 22, style: 'bold' })
    text(subtitle, margin, 60, { size: 9.5, color: muted })
    doc.setDrawColor(...theme.border)
    doc.line(margin, 67, 210 - margin, 67)
  }

  function metricCard(x: number, y: number, width: number, label: string, value: string, accent: Rgb = purple) {
    doc.setFillColor(...theme.surface)
    doc.setDrawColor(...theme.border)
    doc.roundedRect(x, y, width, 25, 3, 3, 'FD')
    doc.setFillColor(...accent)
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
      doc.setFillColor(...theme.elevated)
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
    metricCard(margin, 75, 55, totalLabel, formatMoney(total))
    metricCard(77, 75, 55, 'Categorías', String(rows.length), COLORS[1])
    metricCard(138, 75, 55, budget === undefined ? 'Moneda' : 'Presupuesto', budget === undefined ? activeCurrency.code : formatMoney(budget), COLORS[2])
    const chartEnd = distributionChart(rows, 115)
    const leader = rows[0]
    doc.setFillColor(...theme.surface)
    doc.setDrawColor(...theme.border)
    doc.roundedRect(margin, Math.min(247, chartEnd + 3), contentWidth, 24, 3, 3, 'FD')
    text('Mayor concentración', margin + 6, Math.min(258, chartEnd + 14), { size: 8, color: muted, style: 'bold' })
    text(`${leader.label}: ${formatMoney(leader.amount)}`, 188, Math.min(258, chartEnd + 14), { size: 10, color: theme.primarySoft, style: 'bold', align: 'right' })
  }

  function drawComparisonRow(label: string, current: number, previous: number, y: number, max: number) {
    text(label, margin, y, { size: 9, style: 'bold' })
    text(formatMoney(current), 193, y, { size: 8.5, style: 'bold', align: 'right' })
    doc.setFillColor(...theme.elevated)
    doc.roundedRect(margin, y + 4, contentWidth, 5, 2, 2, 'F')
    doc.setFillColor(...COLORS[1])
    doc.roundedRect(margin, y + 4, Math.max(2, contentWidth * (current / max)), 2.2, 1, 1, 'F')
    doc.setFillColor(...COLORS[4])
    doc.roundedRect(margin, y + 6.8, Math.max(2, contentWidth * (previous / max)), 2.2, 1, 1, 'F')
    text(`Anterior ${formatMoney(previous)}`, margin, y + 15, { size: 7.5, color: muted })
  }

  function addComparisonPage() {
    doc.addPage()
    pageHeader('Comparador entre ciclos', 'El cierre actual frente al último ciclo guardado.')
    const rows = [
      { label: 'Gastos', current: input.overview.totalExpenses, previous: previousExpenses },
      { label: 'Gustos', current: input.overview.totalWants, previous: previousWants },
    ]
    const max = Math.max(1, ...rows.flatMap((row) => [row.current, row.previous]))
    text('Ciclo actual', margin, 81, { size: 8, color: COLORS[1], style: 'bold' })
    text('Ciclo anterior', margin + 45, 81, { size: 8, color: COLORS[4], style: 'bold' })
    rows.forEach((row, index) => drawComparisonRow(row.label, row.current, row.previous, 101 + index * 42, max))

    const expenseDelta = input.overview.totalExpenses - previousExpenses
    const wantsDelta = input.overview.totalWants - previousWants
    metricCard(margin, 205, 84, 'Variación gastos', `${expenseDelta >= 0 ? '+' : '-'}${formatMoney(Math.abs(expenseDelta))}`, expenseDelta > 0 ? COLORS[3] : COLORS[2])
    metricCard(109, 205, 84, 'Variación gustos', `${wantsDelta >= 0 ? '+' : '-'}${formatMoney(Math.abs(wantsDelta))}`, wantsDelta > 0 ? COLORS[3] : COLORS[2])
  }

  function addTrendPage() {
    doc.addPage()
    pageHeader('Línea temporal: Gastos vs Gustos', 'Evolución de los cierres guardados y del ciclo actual.')
    const chartLeft = margin + 12
    const chartRight = 193
    const chartTop = 93
    const chartBottom = 230
    const chartWidth = chartRight - chartLeft
    const chartHeight = chartBottom - chartTop
    const max = Math.max(1, ...trendSeries.flatMap((entry) => [entry.expenses, entry.wants]))

    doc.setDrawColor(...theme.border)
    doc.setLineWidth(0.25)
    for (let step = 0; step <= 4; step += 1) {
      const y = chartBottom - (chartHeight * step / 4)
      doc.line(chartLeft, y, chartRight, y)
      text(formatMoney(max * step / 4), chartLeft - 3, y + 1.5, { size: 6.5, color: muted, align: 'right' })
    }

    const pointX = (index: number) => trendSeries.length === 1
      ? chartLeft + chartWidth / 2
      : chartLeft + chartWidth * index / (trendSeries.length - 1)
    const pointY = (value: number) => chartBottom - chartHeight * value / max
    const drawSeries = (key: 'expenses' | 'wants', color: Rgb) => {
      doc.setDrawColor(...color)
      doc.setFillColor(...color)
      doc.setLineWidth(1)
      trendSeries.forEach((entry, index) => {
        const x = pointX(index)
        const y = pointY(entry[key])
        if (index > 0) {
          const previous = trendSeries[index - 1]
          doc.line(pointX(index - 1), pointY(previous[key]), x, y)
        }
        doc.circle(x, y, 1.7, 'F')
      })
    }
    drawSeries('expenses', COLORS[1])
    drawSeries('wants', COLORS[4])

    trendSeries.forEach((entry, index) => {
      text(entry.label, pointX(index), chartBottom + 8, { size: 6.5, color: muted, align: 'center' })
    })
    text('Gastos', margin, 79, { size: 8, color: COLORS[1], style: 'bold' })
    text('Gustos', margin + 33, 79, { size: 8, color: COLORS[4], style: 'bold' })
    text(`Actual: ${formatMoney(input.overview.totalExpenses)} en gastos y ${formatMoney(input.overview.totalWants)} en gustos.`, margin, 254, { size: 9, color: muted, maxWidth: contentWidth })
  }

  function addBudgetAndScorePage() {
    doc.addPage()
    pageHeader('Presupuesto, fugas y score', 'Desviación del ciclo y señales que explican el resultado.')
    const budgetRows: Array<{ label: string; actual: number; budget: number; color: Rgb }> = [
      { label: 'Gastos', actual: input.overview.totalExpenses, budget: input.overview.budgetExpenses, color: COLORS[1] },
      { label: 'Gustos', actual: input.overview.totalWants, budget: input.overview.budgetWants, color: COLORS[4] },
      { label: 'Ahorro', actual: input.overview.totalSavings, budget: input.overview.budgetSavings, color: COLORS[2] },
    ]
    let y = 82
    budgetRows.forEach((row) => {
      const ratio = row.budget > 0 ? Math.min(1, row.actual / row.budget) : 0
      text(row.label, margin, y, { size: 9, style: 'bold' })
      text(`${formatMoney(row.actual)} de ${formatMoney(row.budget)}`, 193, y, { size: 8, align: 'right' })
      doc.setFillColor(...theme.elevated)
      doc.roundedRect(margin, y + 4, contentWidth, 5, 2, 2, 'F')
      doc.setFillColor(...row.color)
      doc.roundedRect(margin, y + 4, Math.max(2, contentWidth * ratio), 5, 2, 2, 'F')
      y += 27
    })

    metricCard(margin, 170, 84, 'Ahorro rescatable', formatMoney(unnecessaryInsights.unnecessaryTotal), COLORS[3])
    metricCard(109, 170, 84, 'Fugas detectadas', String(unnecessaryInsights.unnecessaryCount), COLORS[4])
    text('Factores del score financiero', margin, 214, { size: 12, style: 'bold' })
    financialScore.factors.forEach((factor, index) => {
      const column = index % 2
      const row = Math.floor(index / 2)
      const x = margin + column * 91
      const factorY = 226 + row * 17
      text(factor.label, x, factorY, { size: 8, color: muted })
      text(`${factor.current}/${factor.max}`, x + 81, factorY, { size: 9, style: 'bold', align: 'right' })
    })
  }

  function addRankingsPage() {
    doc.addPage()
    pageHeader('Rankings del ciclo', 'Categorías y productos que concentraron más dinero.')
    const rankingColumn = (title: string, rows: DistributionRow[], x: number) => {
      text(title, x, 82, { size: 12, style: 'bold' })
      rows.slice(0, 8).forEach((row, index) => {
        const y = 98 + index * 21
        doc.setFillColor(...theme.surface)
        doc.setDrawColor(...theme.border)
        doc.roundedRect(x, y - 8, 84, 16, 2, 2, 'FD')
        text(`${index + 1}. ${row.label}`, x + 4, y - 1, { size: 7.8, style: 'bold', maxWidth: 48 })
        text(formatMoney(row.amount), x + 80, y + 2, { size: 7.5, color: theme.primarySoft, style: 'bold', align: 'right' })
      })
    }
    rankingColumn('Top categorías', groupAmounts([...expenses, ...wants]), margin)
    rankingColumn('Top productos', products, 109)
  }

  function addPatternsPage() {
    doc.addPage()
    pageHeader('Lo más repetido', 'Frecuencia de categorías actuales y productos del ciclo anterior.')
    const countColumn = (title: string, rows: Array<{ label: string; count: number }>, x: number) => {
      text(title, x, 82, { size: 11, style: 'bold', maxWidth: 82 })
      if (rows.length === 0) {
        text('Sin repeticiones suficientes.', x, 100, { size: 8, color: muted })
        return
      }
      rows.slice(0, 8).forEach((row, index) => {
        const y = 101 + index * 21
        doc.setFillColor(...theme.surface)
        doc.setDrawColor(...theme.border)
        doc.roundedRect(x, y - 8, 84, 16, 2, 2, 'FD')
        text(`${index + 1}. ${row.label}`, x + 4, y + 1, { size: 7.8, style: 'bold', maxWidth: 60 })
        text(`${row.count}x`, x + 79, y + 1, { size: 9, color: theme.primarySoft, style: 'bold', align: 'right' })
      })
    }
    countColumn('Categorías de este ciclo', repeatedCurrentCategories, margin)
    countColumn('Productos del ciclo anterior', repeatedPreviousProducts, 109)
  }

  function addTimelinePages() {
    const debtEntries = input.debts.flatMap((debt) => (debt.payments ?? [])
      .filter((payment) => payment.date.slice(0, 10) >= periodStart && payment.date.slice(0, 10) <= periodEnd)
      .map((payment) => ({ date: payment.date, type: 'Pago de deuda', label: debt.history || 'Abono', amount: -payment.amount })))
    const eventEntries = (input.events ?? [])
      .filter((event) => event.date.slice(0, 10) >= periodStart && event.date.slice(0, 10) <= periodEnd)
      .map((event) => ({ date: event.date, type: 'Evento', label: event.name, amount: 0 }))
    const transactionEntries = currentTransactions.flatMap((transaction) => {
      if (transaction.type === 'expense') {
        const parsed = parseExpenseDescription(transaction.description)
        if (parsed.status !== 'checked') return []
        return [{ date: transaction.date, type: 'Gasto', label: parsed.itemName, amount: -transaction.amount }]
      }
      if (transaction.type === 'want') {
        const parsed = parseWantDescription(transaction.description)
        if (parsed.status !== 'checked') return []
        return [{ date: transaction.date, type: 'Gusto', label: parsed.itemName, amount: -transaction.amount }]
      }
      return [{ date: transaction.date, type: 'Ahorro', label: transaction.description || 'Aporte al ahorro', amount: -transaction.amount }]
    })
    const entries = [
      { date: periodStart, type: 'Ingreso', label: 'Ingreso del ciclo', amount: input.overview.totalSalary },
      ...transactionEntries,
      ...debtEntries,
      ...eventEntries,
    ].sort((left, right) => left.date.localeCompare(right.date))

    const chunks = Array.from({ length: Math.max(1, Math.ceil(entries.length / 12)) }, (_, index) => entries.slice(index * 12, index * 12 + 12))
    chunks.forEach((chunk, pageIndex) => {
      doc.addPage()
      pageHeader('Timeline financiero', pageIndex === 0 ? 'Movimientos desde el último reset hasta el cierre.' : `Continuación ${pageIndex + 1}.`)
      chunk.forEach((entry, index) => {
        const y = 82 + index * 16
        doc.setFillColor(...theme.surface)
        doc.setDrawColor(...theme.border)
        doc.roundedRect(margin, y - 8, contentWidth, 13, 2, 2, 'FD')
        text(new Date(`${entry.date.slice(0, 10)}T12:00:00`).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }), margin + 4, y, { size: 7, color: muted })
        text(entry.type, margin + 28, y, { size: 7.5, color: theme.primarySoft, style: 'bold' })
        text(entry.label || 'Sin descripción', margin + 57, y, { size: 7.5, maxWidth: 78 })
        text(entry.amount === 0 ? '-' : `${entry.amount > 0 ? '+' : '-'}${formatMoney(Math.abs(entry.amount))}`, 189, y, { size: 8, style: 'bold', align: 'right' })
      })
    })
  }

  function addFindingsPage() {
    doc.addPage()
    pageHeader('Hallazgos clave', 'Qué impulsó el score y qué conviene corregir en el próximo ciclo.')
    financialScore.changes.slice(0, 8).forEach((finding, index) => {
      const y = 82 + index * 25
      const color: Rgb = finding.direction === 'up' ? COLORS[2] : COLORS[3]
      doc.setFillColor(...theme.surface)
      doc.setDrawColor(...theme.border)
      doc.roundedRect(margin, y - 8, contentWidth, 20, 3, 3, 'FD')
      doc.setFillColor(...color)
      doc.circle(margin + 6, y, 2, 'F')
      text(finding.label, margin + 12, y - 1, { size: 8.5, style: 'bold', maxWidth: 150 })
      text(finding.detail, margin + 12, y + 6, { size: 7.2, color: muted, maxWidth: 150 })
    })
  }

  pageHeader(
    input.mode === 'closing' ? 'Informe de cierre del ciclo' : 'Informe financiero actual',
    `Resumen personal en ${activeCurrency.code} · Actualizado ${generatedAt.toLocaleDateString('es-ES')}`,
  )
  metricCard(margin, 75, 55, 'Ingresos del ciclo', formatMoney(input.overview.totalSalary))
  metricCard(77, 75, 55, 'Score financiero', `${financialScore.score}/100`, meaning.tone)
  metricCard(138, 75, 55, 'Ahorro del ciclo', formatMoney(input.overview.totalSavings), COLORS[2])

  doc.setFillColor(...theme.surface)
  doc.setDrawColor(meaning.tone[0], meaning.tone[1], meaning.tone[2])
  doc.roundedRect(margin, 110, contentWidth, 31, 3, 3, 'FD')
  doc.setFillColor(meaning.tone[0], meaning.tone[1], meaning.tone[2])
  doc.roundedRect(margin, 110, 3, 31, 1, 1, 'F')
  text(`Resultado: ${meaning.label}`, margin + 8, 122, { size: 14, style: 'bold' })
  text(meaning.detail, margin + 8, 132, { size: 9, color: muted, maxWidth: contentWidth - 16 })

  const periodSalaryRows = (input.salaries ?? []).filter((salary) => salary.month === periodEnd.slice(0, 7))
  const fixedIncomeLabel = periodSalaryRows.length > 0 && periodSalaryRows.every((salary) => salary.kind !== 'one-off')
    ? 'fijo'
    : 'registrado'
  text('Resumen del ciclo', margin, 154, { size: 14, style: 'bold' })
  text(
    `En este ciclo tu ingreso ${fixedIncomeLabel} fue de ${formatMoney(input.overview.totalSalary)}. La fórmula lo dividió en ${formatMoney(input.overview.budgetExpenses)} para gastos, ${formatMoney(input.overview.budgetWants)} para gustos y ${formatMoney(input.overview.budgetSavings)} para ahorro.`,
    margin,
    164,
    { size: 9, color: muted, maxWidth: contentWidth },
  )
  text(
    `Usaste ${formatMoney(input.overview.totalExpenses)} de ${formatMoney(input.overview.budgetExpenses)} en gastos, ${formatMoney(input.overview.totalWants)} de ${formatMoney(input.overview.budgetWants)} en gustos y ahorraste ${formatMoney(input.overview.totalSavings)} de una meta de ${formatMoney(input.overview.budgetSavings)}.`,
    margin,
    179,
    { size: 9, color: muted, maxWidth: contentWidth },
  )
  doc.setFillColor(...theme.surface)
  doc.setDrawColor(...theme.border)
  doc.roundedRect(margin, 199, 84, 69, 3, 3, 'FD')
  doc.roundedRect(109, 199, 84, 69, 3, 3, 'FD')
  text('Qué debes seguir haciendo', margin + 6, 211, { size: 11, color: COLORS[2], style: 'bold' })
  advice.continueItems.forEach((item, index) => text(`- ${item}`, margin + 6, 222 + index * 14, { size: 8.3, maxWidth: 72 }))
  text('Qué debes mejorar', 115, 211, { size: 11, color: [248, 113, 113], style: 'bold' })
  advice.improveItems.forEach((item, index) => text(`- ${item}`, 115, 222 + index * 14, { size: 8.3, maxWidth: 72 }))

  if (expenses.length) addDistributionPage('Gastos del ciclo', 'Cuánto gastaste y cómo se distribuyó entre categorías.', expenses, 'Total gastado', input.overview.budgetExpenses)
  if (wants.length) addDistributionPage('Gustos del ciclo', 'Distribución del consumo flexible y experiencias del período.', wants, 'Total en gustos', input.overview.budgetWants)
  if (savings.length && savings.some((row) => row.amount > 0)) {
    addDistributionPage('Ahorros y deseos', 'Ahorro conservado y deseos comprados con el dinero reservado.', savings, 'Ahorro gestionado', input.overview.budgetSavings)
  }
  addComparisonPage()
  addTrendPage()
  addBudgetAndScorePage()
  addRankingsPage()
  addPatternsPage()
  addTimelinePages()
  addFindingsPage()

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...muted)
    doc.text(`Plata App · ${input.userName || 'Usuario'} · ${periodLabel}`, margin, 289)
    doc.text(`Página ${page} de ${pages}`, 193, 289, { align: 'right' })
  }

  const monthKey = generatedAt.toISOString().slice(0, 7)
  if (input.output === 'arraybuffer') return doc.output('arraybuffer')
  doc.save(`informe-financiero-${monthKey}.pdf`)
}
